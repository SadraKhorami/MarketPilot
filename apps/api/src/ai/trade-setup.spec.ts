import { defaultTradePreferences, resolveEntryPolicy } from "@marketpilot/ai";
import {
  calculateSupportResistance,
  calculateTechnicalIndicators,
  calculateTrend,
  type MarketDataInterval,
} from "@marketpilot/market-data";
import type { MarketSnapshot } from "../market-data/market-data.service";
import { calculateTradeSetup } from "./trade-setup";

const now = Date.UTC(2026, 9, 4, 16);
function snapshot(interval: MarketDataInterval, nearTarget?: number): MarketSnapshot {
  const duration = interval === "15m" ? 900_000 : 3_600_000;
  const candles = Array.from({ length: 300 }, (_, index) => ({
    time: new Date(now - (300 - index) * duration).toISOString(),
    open: index < 275 ? 110 : 119,
    close: index < 275 ? 110 : 119,
    high: index < 275 ? 112 : 120,
    low: index < 275 ? 108 : 114,
    volume: 10,
  }));
  candles[100].high = 140;
  if (nearTarget) candles[150].high = nearTarget;
  const indicators = calculateTechnicalIndicators(candles);
  return {
    source: "coinbase-exchange",
    requestedSymbol: "SOL-USD",
    freshness: "fresh",
    fetchedAt: new Date(now).toISOString(),
    data: {
      symbol: "SOL-USD",
      providerSymbol: "SOL-USD",
      interval,
      price: 119.5,
      timestamp: new Date(now).toISOString(),
      candles,
      indicators,
      trend: calculateTrend(119.5, indicators),
      supportResistance: calculateSupportResistance(candles),
      marketStatus: { isOpen: true },
      volatility: { atr: indicators.atr, atrPercentage: null },
    },
  };
}
function options(cost: number | null = 0) {
  return {
    preferences: {
      ...defaultTradePreferences,
      capital: 100,
      entryPolicy: {
        ...resolveEntryPolicy(defaultTradePreferences),
        roundTripCostPercent: cost,
        minimumNetRewardRisk: 1.5,
      },
    },
    news: {
      status: "unavailable" as const,
      latestPublishedAt: null,
      checkedAt: new Date(now).toISOString(),
      sourceIds: [],
      calendar: "unavailable" as const,
    },
  };
}
describe("validated trade target evidence", () => {
  it("aligns new close deadlines with the actual observed candle boundaries", () => {
    const data = snapshot("15m");
    data.data.candles = data.data.candles.map((candle) => ({
      ...candle,
      time: new Date(Date.parse(candle.time) - 600_000).toISOString(),
    }));
    const result = calculateTradeSetup(data, "BUY", "source", now, snapshot("1h"), options());
    expect(result.reason).toBeNull();
    expect(result.plan?.conditionalEntry?.candleOffsetMs).toBe(300_000);
    expect(result.plan?.expiresAt).toBe(new Date(now + 2100_000).toISOString());
  });
  it.each(["BUY", "SELL"] as const)(
    "does not claim trend alignment when explicit %s conflicts with the entry trend",
    (direction) => {
      const data = snapshot("15m");
      const higher = snapshot("1h");
      if (direction === "SELL") {
        for (const value of [data, higher]) {
          value.data.price = 200 - value.data.price;
          value.data.candles = value.data.candles.map((candle) => ({
            ...candle,
            open: 200 - candle.open,
            close: 200 - candle.close,
            high: 200 - candle.low,
            low: 200 - candle.high,
          }));
        }
      }
      const last = data.data.candles[data.data.candles.length - 1];
      Object.assign(
        last,
        direction === "BUY" ? { open: 109, close: 109, low: 108 } : { open: 91, close: 91, high: 92 },
      );
      const result = calculateTradeSetup(data, direction, "source", now, higher, options());
      expect(result.plan).toBeNull();
      expect(result.reason).toMatch(/entry-timeframe trend/);
    },
  );
  it("uses executable descriptions and close boundaries rather than arbitrary AI rules", () => {
    const proposedAt = now + 254_456;
    const result = calculateTradeSetup(snapshot("15m"), "BUY", "source", proposedAt, snapshot("1h"), {
      ...options(),
      rationale: "Close below entry invalidates and requires a reclaim.",
      validityReason: "Exit open trades at the deadline.",
    });
    expect(result.reason).toBeNull();
    expect(result.plan?.stage).toBe("waiting_close");
    expect(result.plan?.conditionalEntry?.validityBasis).toBe("entry_candle_closes");
    expect(result.plan?.expiresAt).toBe(new Date(now + 2700_000).toISOString());
    expect(result.plan?.conditionalEntry?.rationale).toMatch(/15m candle closes above Entry/);
    expect(result.plan?.conditionalEntry?.rationale).not.toMatch(/reclaim/);
    expect(result.plan?.conditionalEntry?.validityReason).toMatch(/Stop touched before entry invalidates/);
    expect(result.plan?.conditionalEntry?.validityReason).not.toMatch(/Exit open trades/);
  });
  it("rejects a higher-timeframe trend calculated across a recent gap", () => {
    const higher = snapshot("1h");
    higher.data.candles.splice(275, 1);
    const result = calculateTradeSetup(snapshot("15m"), "BUY", "source", now, higher, options());
    expect(result.plan).toBeNull();
    expect(result.reason).toMatch(/higher-timeframe candles contain gaps/);
  });
  it("uses historical confirmed wick levels beyond entry instead of close percentiles", () => {
    const result = calculateTradeSetup(snapshot("15m"), "BUY", "source", now, snapshot("1h"), options());
    expect(result.reason).toBeNull();
    expect(result.plan?.targets).toEqual([140]);
    expect(result.plan?.entry).toBe(120);
    expect(result.plan?.conditionalEntry?.economics?.netRewardRisk).toBeGreaterThan(1.5);
  });
  it("does not skip a close weak target merely to make distant targets pass quality checks", () => {
    const result = calculateTradeSetup(snapshot("15m", 121), "BUY", "source", now, snapshot("1h", 121), options());
    expect(result.plan).toBeNull();
    expect(result.reason).toMatch(/weighted net reward/);
  });
  it("does not turn unknown costs or an open candle high into an accepted setup", () => {
    const data = snapshot("15m");
    data.data.candles.push({
      time: new Date(now).toISOString(),
      open: 119,
      high: 200,
      low: 118,
      close: 190,
      volume: 1,
    });
    const result = calculateTradeSetup(data, "BUY", "source", now, snapshot("1h"), options());
    expect(result.plan?.entry).toBe(120);
    expect(result.plan?.targets).toEqual([140]);
    expect(calculateTradeSetup(data, "BUY", "source", now, snapshot("1h"), options(null)).plan).toBeNull();
  });
});
