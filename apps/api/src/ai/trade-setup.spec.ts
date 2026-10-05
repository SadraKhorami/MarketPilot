import { defaultTradePreferences, resolveEntryPolicy, TradeSetupSchema } from "@marketpilot/ai";
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
    expect(result.assessment).toBe("unavailable");
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
  it("accepts observed weak targets with the ratio threshold disabled and preserves zero in the save contract", () => {
    const settings = options();
    settings.preferences.entryPolicy.minimumNetRewardRisk = 0;
    const result = calculateTradeSetup(snapshot("15m", 121), "BUY", "source", now, snapshot("1h", 121), settings);
    expect(result.reason).toBeNull();
    expect(result.plan?.targets[0]).toBe(121);
    expect(result.plan?.conditionalEntry?.economics?.netRewardRisk).toBeLessThan(1.5);
    expect(result.plan?.conditionalEntry?.economics?.minimumNetRewardRisk).toBe(0);
    expect(TradeSetupSchema.safeParse(result.plan).success).toBe(true);
    const unknownCosts = options(null);
    unknownCosts.preferences.entryPolicy.minimumNetRewardRisk = 0;
    expect(calculateTradeSetup(snapshot("15m"), "BUY", "source", now, snapshot("1h"), unknownCosts).plan).toBeNull();
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

describe("OANDA metals session continuity in setup validation", () => {
  const evaluatedAt = Date.parse("2026-10-05T09:16:06.039Z");
  function goldSnapshot(interval: "15m" | "1h"): MarketSnapshot {
    const value = snapshot(interval);
    const duration = interval === "15m" ? 900_000 : 3_600_000;
    const times: string[] = [];
    // This October fixture is in daylight saving time: daily closure starts
    // at 21:00 UTC and the first partially traded bucket reopens at 22:00.
    for (let time = Math.floor(evaluatedAt / duration) * duration - duration; times.length < 300; time -= duration) {
      const date = new Date(time);
      const day = date.getUTCDay();
      const hour = date.getUTCHours();
      if (day === 6 || (day === 5 && hour >= 21) || (day === 0 && hour < 22) || hour === 21) continue;
      times.unshift(date.toISOString());
    }
    value.source = "tradingview";
    value.requestedSymbol = value.data.symbol = "XAU-USD";
    value.data.providerSymbol = "OANDA:XAUUSD";
    value.fetchedAt = value.data.timestamp = new Date(evaluatedAt).toISOString();
    value.data.candles = value.data.candles.map((candle, index) => ({ ...candle, time: times[index] }));
    return value;
  }
  it("evaluates a valid setup across the daily and weekend closures in both timeframes", () => {
    const result = calculateTradeSetup(
      goldSnapshot("15m"),
      "BUY",
      "source",
      evaluatedAt,
      goldSnapshot("1h"),
      options(),
    );
    expect(result.reason).toBeNull();
    expect(result.plan).not.toBeNull();
  });
  it.each(["15m", "1h"] as const)("still blocks a missing in-session %s candle", (interval) => {
    const entry = goldSnapshot("15m");
    const higher = goldSnapshot("1h");
    (interval === "15m" ? entry : higher).data.candles.splice(-10, 1);
    const result = calculateTradeSetup(entry, "BUY", "source", evaluatedAt, higher, options());
    expect(result.assessment).toBe("unavailable");
    expect(result.reason).toContain("contain gaps");
  });
});

describe("setup screening strictness", () => {
  function preferences(strictness: "low" | "balanced" | "high") {
    const base = options();
    return {
      ...base,
      preferences: { ...base.preferences, entryPolicy: { ...base.preferences.entryPolicy, strictness } },
    };
  }
  it("preserves balanced behavior for legacy preferences and records the applied rules", () => {
    const legacy = calculateTradeSetup(snapshot("15m"), "AUTO", "source", now, snapshot("1h"), options());
    const balanced = calculateTradeSetup(
      snapshot("15m"),
      "AUTO",
      "source",
      now,
      snapshot("1h"),
      preferences("balanced"),
    );
    expect(balanced).toEqual(legacy);
    expect(balanced.plan?.conditionalEntry?.strictness).toBe("balanced");
    expect(balanced.plan?.conditionalEntry?.evidence?.trendStatus).toBe("aligned");
  });
  it("permits 30-candle entry history at low with a disclosed SMA30 basis", () => {
    const data = snapshot("15m");
    data.data.candles = data.data.candles.slice(-30);
    data.data.candles[4].high = 140;
    const low = calculateTradeSetup(data, "AUTO", "source", now, snapshot("1h"), preferences("low"));
    expect(low.reason).toBeNull();
    expect(low.plan?.conditionalEntry?.evidence).toMatchObject({
      entryCandles: 30,
      entryAveragePeriod: 30,
      limitations: ["limited_entry_history"],
    });
    expect(calculateTradeSetup(data, "AUTO", "source", now, snapshot("1h"), preferences("balanced")).plan).toBeNull();
  });
  it("requires at least 100 candles at high", () => {
    const data = snapshot("15m");
    data.data.candles = data.data.candles.slice(-60);
    data.data.candles[4].high = 140;
    expect(calculateTradeSetup(data, "AUTO", "source", now, snapshot("1h"), preferences("balanced")).reason).toBeNull();
    expect(calculateTradeSetup(data, "AUTO", "source", now, snapshot("1h"), preferences("high")).reason).toMatch(
      /100 completed candles/,
    );
  });
  it("discloses opposing higher trend at low instead of claiming alignment", () => {
    const higher = snapshot("1h");
    higher.data.candles[higher.data.candles.length - 1].close = 109;
    higher.data.candles[higher.data.candles.length - 1].open = 109;
    higher.data.candles[higher.data.candles.length - 1].low = 108;
    const low = calculateTradeSetup(snapshot("15m"), "AUTO", "source", now, higher, preferences("low"));
    expect(low.reason).toBeNull();
    expect(low.plan?.conditionalEntry?.evidence?.limitations).toContain("trend_conflict");
    expect(low.plan?.conditionalEntry?.rationale).toMatch(/trend conflicting/);
    expect(calculateTradeSetup(snapshot("15m"), "AUTO", "source", now, higher, preferences("balanced")).reason).toMatch(
      /disagree/,
    );
  });
  it("accepts only entry evidence at low when higher context is missing", () => {
    const low = calculateTradeSetup(snapshot("15m"), "AUTO", "source", now, undefined, preferences("low"));
    expect(low.reason).toBeNull();
    expect(low.plan?.conditionalEntry?.evidence).toMatchObject({
      trendStatus: "unavailable",
      trendCandles: 0,
      trendAveragePeriod: null,
      limitations: ["trend_unavailable"],
    });
    expect(low.plan?.contextInterval).toBeUndefined();
    expect(
      calculateTradeSetup(snapshot("15m"), "AUTO", "source", now, undefined, preferences("balanced")).plan,
    ).toBeNull();
  });
  it("discloses a shorter higher trend history and rejects falsified entry-only provenance", () => {
    const higher = snapshot("1h");
    higher.data.candles = higher.data.candles.slice(-35);
    const low = calculateTradeSetup(snapshot("15m"), "AUTO", "source", now, higher, preferences("low"));
    expect(low.plan?.conditionalEntry?.evidence).toMatchObject({
      trendCandles: 35,
      trendAveragePeriod: 30,
      limitations: ["limited_trend_history"],
    });
    const entryOnly = calculateTradeSetup(snapshot("15m"), "AUTO", "source", now, undefined, preferences("low")).plan;
    expect(entryOnly).not.toBeNull();
    expect(
      TradeSetupSchema.safeParse({
        ...entryOnly,
        conditionalEntry: { ...entryOnly?.conditionalEntry, strictness: "high" },
      }).success,
    ).toBe(false);
  });
  it("changes distance screening while keeping observed targets and economics", () => {
    const data = snapshot("15m");
    data.data.candles[100].high = 180;
    data.data.candles[data.data.candles.length - 10].high = 124;
    data.data.price = 114.5;
    const higher = snapshot("1h");
    higher.data.candles[100].high = 180;
    const low = calculateTradeSetup(data, "AUTO", "source", now, higher, preferences("low"));
    expect(low.reason).toBeNull();
    expect(low.plan?.entry).toBe(124);
    expect(low.plan?.targets).toEqual([180]);
    expect(calculateTradeSetup(data, "AUTO", "source", now, snapshot("1h"), preferences("balanced")).reason).toMatch(
      /too far/,
    );
    expect(
      calculateTradeSetup(snapshot("15m", 121), "AUTO", "source", now, snapshot("1h", 121), preferences("low")).reason,
    ).toMatch(/weighted net reward/);
  });
  it.each(["low", "balanced", "high"] as const)("still rejects unhealthy evidence and unknown costs at %s", (level) => {
    const data = snapshot("15m");
    data.data.candles[data.data.candles.length - 2].high = 1;
    expect(calculateTradeSetup(data, "AUTO", "source", now, snapshot("1h"), preferences(level)).assessment).toBe(
      "unavailable",
    );
    const opts = preferences(level);
    opts.preferences.entryPolicy.roundTripCostPercent = null;
    expect(calculateTradeSetup(snapshot("15m"), "AUTO", "source", now, snapshot("1h"), opts).plan).toBeNull();
    const higher = snapshot("1h");
    higher.data.candles.splice(275, 1);
    expect(calculateTradeSetup(snapshot("15m"), "AUTO", "source", now, higher, preferences(level)).assessment).toBe(
      "unavailable",
    );
  });
});
