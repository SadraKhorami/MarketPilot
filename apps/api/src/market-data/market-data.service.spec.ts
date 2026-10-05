import {
  type MarketDataInterval,
  type MarketDataProvider,
  MarketDataProviderError,
  type MarketObservation,
} from "@marketpilot/market-data";
import { ServiceUnavailableException } from "@nestjs/common";

import type { RedisService } from "../redis.service";
import { MarketDataService } from "./market-data.service";

const observation: MarketObservation = {
  symbol: "BTC-USD",
  providerSymbol: "BTC-USD",
  interval: "15m",
  price: 100,
  timestamp: "2026-09-29T10:00:00.000Z",
  candles: [{ time: "2026-09-29T09:45:00.000Z", open: 99, high: 101, low: 98, close: 100, volume: 2 }],
  indicators: {
    rsi: null,
    macd: null,
    sma50: null,
    sma200: null,
    bollingerBands: null,
    stochastic: null,
    atr: null,
  },
  trend: null,
  supportResistance: { support: [98], resistance: [100] },
  marketStatus: { isOpen: true },
  volatility: { atr: null, atrPercentage: null },
};

describe("MarketDataService", () => {
  let store: Map<string, string>;
  let redis: RedisService;
  let provider: MarketDataProvider & { getMarketData: jest.Mock };

  beforeEach(() => {
    store = new Map();
    redis = {
      ensureConnected: jest.fn(async () => undefined),
      client: {
        get: jest.fn(async (key: string) => store.get(key) ?? null),
        set: jest.fn(async (key: string, value: string) => {
          store.set(key, value);
          return "OK";
        }),
      },
    } as unknown as RedisService;
    provider = {
      id: "coinbase-exchange",
      getMarketData: jest.fn(async (_symbol: string, _interval: MarketDataInterval) => observation),
    };
  });

  it("uses its provider once and serves a fresh validated Redis entry", async () => {
    const service = new MarketDataService(provider, redis);
    const first = await service.getMarketData("btc-usd", "15m");
    const second = await service.getMarketData("BTC-USD", "15m");

    expect(first.freshness).toBe("fresh");
    expect(second.freshness).toBe("fresh");
    expect(second.data.price).toBe(100);
    expect(provider.getMarketData).toHaveBeenCalledTimes(1);
    expect(redis.client.set).toHaveBeenCalledWith(
      "marketpilot:market-data:v1:coinbase-exchange:BTC-USD:15m",
      expect.any(String),
      "EX",
      900,
    );
  });

  it("returns cached observations with an explicit stale state if provider refresh fails", async () => {
    const key = "marketpilot:market-data:v1:coinbase-exchange:BTC-USD:15m";
    store.set(
      key,
      JSON.stringify({
        source: "coinbase-exchange",
        requestedSymbol: "BTC-USD",
        data: observation,
        freshness: "fresh",
        fetchedAt: new Date(Date.now() - 120_000).toISOString(),
      }),
    );
    provider.getMarketData.mockRejectedValue(new MarketDataProviderError("provider offline", "UNAVAILABLE"));

    const result = await new MarketDataService(provider, redis).getMarketData("BTC-USD", "15m");

    expect(result.freshness).toBe("stale");
    expect(result.data.price).toBe(100);
  });

  it("does not return provider data when no cache exists and the provider is unavailable", async () => {
    provider.getMarketData.mockRejectedValue(new MarketDataProviderError("provider offline", "UNAVAILABLE"));

    await expect(new MarketDataService(provider, redis).getMarketData("BTC-USD", "15m")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
  it.each([
    { ...observation, symbol: "SOL-USD" },
    { ...observation, providerSymbol: "BTC-EUR" },
    { ...observation, interval: "1m" },
    { ...observation, candles: [{ ...observation.candles[0], low: 102 }] },
    { ...observation, candles: [...observation.candles, ...observation.candles] },
  ])("rejects mismatching or invalid provider observations before caching", async (invalid) => {
    provider.getMarketData.mockResolvedValue(invalid);
    await expect(new MarketDataService(provider, redis).getMarketData("BTC-USD", "15m")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(redis.client.set).not.toHaveBeenCalled();
  });
  it.each(["wrong-symbol", "wrong-source", "future", "expired"])("ignores %s cache entries", async (kind) => {
    store.set(
      "marketpilot:market-data:v1:coinbase-exchange:BTC-USD:15m",
      JSON.stringify({
        source: kind === "wrong-source" ? "other" : "coinbase-exchange",
        requestedSymbol: "BTC-USD",
        data: kind === "wrong-symbol" ? { ...observation, symbol: "SOL-USD" } : observation,
        fetchedAt: new Date(
          Date.now() + (kind === "future" ? 60_000 : kind === "expired" ? -901_000 : -1000),
        ).toISOString(),
      }),
    );
    await new MarketDataService(provider, redis).getMarketData("BTC-USD", "15m");
    expect(provider.getMarketData).toHaveBeenCalledTimes(1);
  });
});

describe("historical tracking pages", () => {
  const cursor = Date.parse("2026-09-29T00:00:00Z");
  const recent = {
    source: "coinbase-exchange",
    requestedSymbol: "BTC-USD",
    freshness: "fresh" as const,
    fetchedAt: new Date().toISOString(),
    data: { ...observation, interval: "1m" as const },
  };
  it("requests a bounded page from the tracking cursor without altering the latest cache", async () => {
    const history = Array.from({ length: 300 }, (_, i) => ({
      ...observation.candles[0],
      time: new Date(cursor + i * 60_000).toISOString(),
    }));
    const provider = {
      id: "coinbase-exchange",
      getMarketData: jest.fn(),
      getCandles: jest.fn().mockResolvedValue(history),
    };
    const redis = { client: { set: jest.fn() } };
    const result = await new MarketDataService(provider, redis as never).getTrackingWindow(recent, cursor + 10_000);
    expect(provider.getCandles).toHaveBeenCalledWith("BTC-USD", "1m", cursor, cursor + 300 * 60_000);
    expect(result.data.candles).toEqual(history);
    expect(redis.client.set).not.toHaveBeenCalled();
  });
  it("keeps existing coverage and rejects out-of-range historical bars", async () => {
    const provider = {
      id: "coinbase-exchange",
      getMarketData: jest.fn(),
      getCandles: jest.fn().mockResolvedValue(observation.candles),
    };
    const service = new MarketDataService(provider, {} as never);
    expect(await service.getTrackingWindow(recent, Date.parse(observation.candles[0].time))).toBe(recent);
    expect(provider.getCandles).not.toHaveBeenCalled();
    await expect(service.getTrackingWindow(recent, cursor)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
