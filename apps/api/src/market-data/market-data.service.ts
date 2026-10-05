import { entryDurations } from "@marketpilot/ai";
import {
  type MarketDataInterval,
  type MarketDataProvider,
  MarketDataProviderError,
  type MarketObservation,
  MarketObservationSchema,
  referenceMarkets,
} from "@marketpilot/market-data";
import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { RedisService } from "../redis.service";

export const MARKET_DATA_PROVIDER = Symbol("MARKET_DATA_PROVIDER");
const FRESH_TTL_SECONDS = 60;
const STALE_TTL_SECONDS = 900;

export interface MarketSnapshot {
  source: string;
  requestedSymbol: string;
  data: MarketObservation;
  freshness: "fresh" | "stale";
  fetchedAt: string;
  candlesObservedAt?: string;
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    @Inject(MARKET_DATA_PROVIDER) private readonly provider: MarketDataProvider,
    private readonly redis: RedisService,
  ) {}

  async getTrackingWindow(snapshot: MarketSnapshot, cursor: number): Promise<MarketSnapshot> {
    const duration = entryDurations[snapshot.data.interval];
    const start = Math.floor(cursor / duration) * duration;
    const availableStart = Date.parse(snapshot.data.candles[0]?.time ?? "");
    if (availableStart <= start) return snapshot;
    if (!Number.isFinite(start) || !this.provider.getCandles)
      throw new ServiceUnavailableException("Historical tracking data is unavailable.");
    // One bounded page per monitor pass. The next pass resumes from the persisted cursor.
    const end = Math.min(start + 300 * duration, Math.floor(Date.now() / duration) * duration);
    const candlesObservedAt = new Date().toISOString();
    const candles = await this.provider.getCandles(snapshot.requestedSymbol, snapshot.data.interval, start, end);
    const data = MarketObservationSchema.parse({ ...snapshot.data, candles });
    if (
      !matchingObservation(data, snapshot.requestedSymbol, data.interval, snapshot.source) ||
      data.candles.some((candle) => Date.parse(candle.time) < start || Date.parse(candle.time) >= end)
    )
      throw new ServiceUnavailableException("Historical tracking candles failed validation.");
    return { ...snapshot, data, candlesObservedAt, fetchedAt: new Date().toISOString() };
  }

  async getMarketData(symbol: string, interval: MarketDataInterval): Promise<MarketSnapshot> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const source = this.provider.sourceFor?.(normalizedSymbol) ?? this.provider.id;
    const cacheKey = `marketpilot:market-data:v1:${source}:${encodeURIComponent(normalizedSymbol)}:${interval}`;
    let cached: string | null = null;

    try {
      await this.redis.ensureConnected();
      cached = await this.redis.client.get(cacheKey);
      const fresh = cached ? parseCache(cached, normalizedSymbol, interval, source) : null;
      if (fresh && Date.now() - Date.parse(fresh.fetchedAt) < FRESH_TTL_SECONDS * 1000) {
        return { ...fresh, freshness: "fresh" };
      }
    } catch {
      this.logger.warn({ event: "market_cache_unavailable" });
    }

    try {
      const candlesObservedAt = new Date().toISOString();
      const parsed = MarketObservationSchema.safeParse(await this.provider.getMarketData(normalizedSymbol, interval));
      if (!parsed.success || !matchingObservation(parsed.data, normalizedSymbol, interval, source))
        throw new MarketDataProviderError(
          "Market observation did not match the request or valid ordered OHLC.",
          "INVALID_RESPONSE",
        );
      const data = parsed.data;
      const record: MarketSnapshot = {
        source,
        requestedSymbol: normalizedSymbol,
        data,
        freshness: "fresh",
        fetchedAt: new Date().toISOString(),
        candlesObservedAt,
      };
      await this.redis.client.set(cacheKey, JSON.stringify(record), "EX", STALE_TTL_SECONDS).catch(() => {
        this.logger.warn({ event: "market_cache_write_failed" });
      });
      return record;
    } catch (error) {
      const stale = cached ? parseCache(cached, normalizedSymbol, interval, source) : null;
      if (stale) return { ...stale, freshness: "stale" };
      if (error instanceof MarketDataProviderError) {
        if (error.code === "INVALID_SYMBOL" || error.code === "UNSUPPORTED_SYMBOL") {
          throw new BadRequestException({ error: { code: `MARKET_${error.code}`, message: error.message } });
        }
        throw new ServiceUnavailableException({
          error: { code: `MARKET_${error.code}`, message: error.message },
        });
      }
      throw new ServiceUnavailableException({
        error: { code: "MARKET_UNAVAILABLE", message: "Market data is temporarily unavailable." },
      });
    }
  }
}

function matchingObservation(data: MarketObservation, symbol: string, interval: MarketDataInterval, source: string) {
  return (
    data.symbol === symbol &&
    data.providerSymbol === (referenceMarkets.find((market) => market.symbol === symbol)?.providerSymbol ?? symbol) &&
    data.interval === interval &&
    (data.source === undefined || data.source === source) &&
    data.candles.every(
      (candle, index, candles) =>
        candle.low <= Math.min(candle.open, candle.close) &&
        candle.high >= Math.max(candle.open, candle.close) &&
        (!index || Date.parse(candle.time) > Date.parse(candles[index - 1].time)),
    )
  );
}

function parseCache(
  value: string,
  symbol: string,
  interval: MarketDataInterval,
  source: string,
): MarketSnapshot | null {
  try {
    const candidate: unknown = JSON.parse(value);
    if (typeof candidate !== "object" || candidate === null) return null;
    const record = candidate as Partial<MarketSnapshot>;
    const observation = MarketObservationSchema.safeParse(record.data);
    if (
      typeof record.source !== "string" ||
      typeof record.requestedSymbol !== "string" ||
      typeof record.fetchedAt !== "string" ||
      !Number.isFinite(Date.parse(record.fetchedAt)) ||
      Date.now() - Date.parse(record.fetchedAt) < 0 ||
      Date.now() - Date.parse(record.fetchedAt) >= STALE_TTL_SECONDS * 1000 ||
      record.source !== source ||
      record.requestedSymbol !== symbol ||
      (record.candlesObservedAt !== undefined &&
        (!Number.isFinite(Date.parse(record.candlesObservedAt)) ||
          Date.parse(record.candlesObservedAt) > Date.parse(record.fetchedAt))) ||
      !observation.success ||
      !matchingObservation(observation.data, symbol, interval, source)
    ) {
      return null;
    }
    return {
      source: record.source,
      requestedSymbol: record.requestedSymbol,
      data: observation.data,
      freshness: "fresh",
      fetchedAt: record.fetchedAt,
      ...(record.candlesObservedAt ? { candlesObservedAt: record.candlesObservedAt } : {}),
    };
  } catch {
    return null;
  }
}
