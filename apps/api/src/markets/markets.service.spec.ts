import { MarketsService } from "./markets.service";
import type { RedisService } from "../redis.service";

const providerPayload = {
  symbol: "BINANCE:BTCUSDT",
  interval: "15",
  price: 100,
  timestamp: "2026-09-29T10:00:00.000Z",
  candles: [{ time: "2026-09-29T09:45:00.000Z", open: 99, high: 101, low: 98, close: 100, volume: 2 }],
  indicators: {
    rsi: 50,
    macd: { value: 1, signal: 0.5, histogram: 0.5 },
    sma50: 99,
    sma200: 98,
    bollingerBands: { upper: 102, middle: 100, lower: 98 },
    stochastic: { k: 51, d: 49 },
    atr: 1,
  },
  trend: "uptrend",
  supportResistance: { support: [95], resistance: [105] },
  marketStatus: { isOpen: true },
  volatility: { atr: 1, atr_percentage: "1.00" },
};

describe("MarketsService", () => {
  const store = new Map<string, string>();
  const redis = {
    ensureConnected: jest.fn(async () => undefined),
    client: {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
        return "OK";
      }),
    },
  } as unknown as RedisService;

  beforeEach(() => {
    store.clear();
    process.env.MARKETFEED_BASE_URL = "http://127.0.0.1:3199";
    process.env.MARKETFEED_API_TOKEN = "test-token";
    jest.restoreAllMocks();
  });

  it("fetches provider data once and serves subsequent fresh cache reads", async () => {
    const fetch = jest.spyOn(global, "fetch").mockResolvedValue(Response.json(providerPayload));
    const service = new MarketsService(redis);
    const first = await service.getMarketData("BTCUSDT", "15");
    const second = await service.getMarketData("BTCUSDT", "15");
    expect(first.freshness).toBe("fresh");
    expect(second.freshness).toBe("fresh");
    expect(second.data.price).toBe(100);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns an explicitly stale cached observation when MarketFeed is unavailable", async () => {
    store.set(
      "marketpilot:marketfeed:v1:BTCUSDT:15",
      JSON.stringify({
        source: "MarketFeed",
        requestedSymbol: "BTCUSDT",
        data: providerPayload,
        freshness: "fresh",
        fetchedAt: "2026-09-29T09:00:00.000Z",
      }),
    );
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("network unavailable"));
    const service = new MarketsService(redis);
    const result = await service.getMarketData("BTCUSDT", "15");
    expect(result.freshness).toBe("stale");
    expect(result.data.price).toBe(100);
  });
});
