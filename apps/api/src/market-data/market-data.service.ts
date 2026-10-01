import {
  type MarketDataInterval,
  type MarketDataProvider,
  MarketDataProviderError,
  type MarketObservation,
  MarketObservationSchema,
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
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    @Inject(MARKET_DATA_PROVIDER) private readonly provider: MarketDataProvider,
    private readonly redis: RedisService,
  ) {}

  async getMarketData(symbol: string, interval: MarketDataInterval): Promise<MarketSnapshot> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const source = this.provider.sourceFor?.(normalizedSymbol) ?? this.provider.id;
    const cacheKey = `marketpilot:market-data:v1:${source}:${encodeURIComponent(normalizedSymbol)}:${interval}`;
    let cached: string | null = null;

    try {
      await this.redis.ensureConnected();
      cached = await this.redis.client.get(cacheKey);
      const fresh = cached ? parseCache(cached) : null;
      if (fresh && Date.now() - Date.parse(fresh.fetchedAt) < FRESH_TTL_SECONDS * 1000) {
        return { ...fresh, freshness: "fresh" };
      }
    } catch {
      this.logger.warn({ event: "market_cache_unavailable" });
    }

    try {
      const data = await this.provider.getMarketData(normalizedSymbol, interval);
      const record: MarketSnapshot = {
        source,
        requestedSymbol: normalizedSymbol,
        data,
        freshness: "fresh",
        fetchedAt: new Date().toISOString(),
      };
      await this.redis.client.set(cacheKey, JSON.stringify(record), "EX", STALE_TTL_SECONDS).catch(() => {
        this.logger.warn({ event: "market_cache_write_failed" });
      });
      return record;
    } catch (error) {
      const stale = cached ? parseCache(cached) : null;
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

function parseCache(value: string): MarketSnapshot | null {
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
      !observation.success
    ) {
      return null;
    }
    return {
      source: record.source,
      requestedSymbol: record.requestedSymbol,
      data: observation.data,
      freshness: "fresh",
      fetchedAt: record.fetchedAt,
    };
  } catch {
    return null;
  }
}
