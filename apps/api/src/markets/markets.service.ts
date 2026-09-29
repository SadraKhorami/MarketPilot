import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import {
  MarketFeedClient,
  MarketFeedError,
  type MarketFeedInterval,
  type MarketFeedResponse,
} from "@marketpilot/marketfeed";

import { RedisService } from "../redis.service";

// Upstream MarketFeed caches a market observation for 900 seconds.
const FRESH_TTL_SECONDS = 900;
const STALE_TTL_SECONDS = 86_400;

export interface MarketSnapshot {
  source: "MarketFeed";
  requestedSymbol: string;
  data: MarketFeedResponse;
  freshness: "fresh" | "stale";
  fetchedAt: string;
}

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);
  private readonly client = new MarketFeedClient({
    baseUrl: process.env.MARKETFEED_BASE_URL,
    token: process.env.MARKETFEED_API_TOKEN,
    timeoutMs: numberFromEnv("MARKETFEED_TIMEOUT_MS", 15_000),
    retries: 1,
    logger: { warn: (message, context) => this.logger.warn(`${message}: ${JSON.stringify(context)}`) },
  });

  constructor(private readonly redis: RedisService) {}

  async getMarketData(symbol: string, interval: MarketFeedInterval): Promise<MarketSnapshot> {
    const normalized = symbol.trim().toUpperCase();
    const cacheKey = `marketpilot:marketfeed:v1:${encodeURIComponent(normalized)}:${interval}`;
    let cached: string | null = null;
    try {
      await this.redis.ensureConnected();
      cached = await this.redis.client.get(cacheKey);
    } catch (error) {
      this.logger.warn(
        `Market cache unavailable; requesting provider data (${error instanceof Error ? error.message : "unknown"})`,
      );
    }
    if (cached) {
      try {
        const record = JSON.parse(cached) as MarketSnapshot;
        if (record.fetchedAt && Date.now() - Date.parse(record.fetchedAt) < FRESH_TTL_SECONDS * 1000)
          return { ...record, freshness: "fresh" };
      } catch {
        cached = null;
      }
    }

    try {
      const data = await this.client.getMarketData(normalized, interval);
      const record: MarketSnapshot = {
        source: "MarketFeed",
        requestedSymbol: normalized,
        data,
        freshness: "fresh",
        fetchedAt: new Date().toISOString(),
      };
      await this.redis.client.set(cacheKey, JSON.stringify(record), "EX", STALE_TTL_SECONDS).catch((error) => {
        this.logger.warn(
          `Could not cache MarketFeed observation (${error instanceof Error ? error.message : "unknown"})`,
        );
      });
      return record;
    } catch (error) {
      if (cached) {
        try {
          const record = JSON.parse(cached) as MarketSnapshot;
          return { ...record, freshness: "stale" };
        } catch {
          // Invalid cached bytes must not be surfaced as a market observation.
        }
      }
      const reason = error instanceof MarketFeedError ? error.code : "UNAVAILABLE";
      throw new ServiceUnavailableException({
        error: { code: `MARKET_DATA_${reason}`, message: publicError(error) },
      });
    }
  }
}

function publicError(error: unknown) {
  if (error instanceof MarketFeedError) {
    if (error.code === "CONFIGURATION")
      return "Market data is not configured. Set MARKETFEED_BASE_URL and MARKETFEED_API_TOKEN.";
    if (error.code === "UNAUTHORIZED") return "MarketFeed rejected the configured credentials.";
    if (error.code === "RATE_LIMITED") return "MarketFeed is rate limited. Try again later.";
    if (error.code === "TIMEOUT") return "MarketFeed timed out. No current market data is available.";
    if (error.code === "INVALID_REQUEST") return "MarketFeed could not find data for this symbol or interval.";
    if (error.code === "INVALID_RESPONSE") return "MarketFeed returned data that failed validation.";
  }
  return "MarketFeed is unavailable. No current market data is available.";
}

function numberFromEnv(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
