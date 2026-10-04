import {
  TradeSetupSchema,
  entryDurations,
  resolveEntryPolicy,
  type ConditionalEntry,
  type TradePreferences,
  type TradeSetup,
} from "@marketpilot/ai";
import { calculateSupportResistance, calculateTechnicalIndicators, referenceMarkets } from "@marketpilot/market-data";
import type { MarketSnapshot } from "../market-data/market-data.service";

const durations = entryDurations;

// Explicit conventions for the reference OANDA instruments. Other assets use quote-price distance.
export function scenarioPipSize(symbol: string): number | null {
  const instrument = referenceMarkets.find((item) => item.symbol === symbol);
  if (instrument?.assetClass === "forex") return instrument.quoteAsset === "JPY" ? 0.01 : 0.0001;
  if (symbol === "XAU-USD") return 0.01;
  return null;
}
export function scenarioPriceDecimals(symbol: string): number {
  const pipSize = scenarioPipSize(symbol);
  return pipSize === 0.0001 ? 5 : symbol.endsWith("-JPY") ? 3 : symbol.endsWith("-USD") ? 2 : 8;
}

export function calculateTradeSetup(
  snapshot: MarketSnapshot,
  requested: "AUTO" | "BUY" | "SELL",
  sourceId: string,
  now = Date.now(),
  context?: MarketSnapshot,
  options?: {
    preferences: TradePreferences;
    scenario?: "breakout" | "pullback";
    condition?: "touch" | "candle_close" | "break_retest";
    validityCandles?: number;
    rationale?: string;
    validityReason?: string;
    news: ConditionalEntry["news"];
  },
): { plan: TradeSetup | null; reason: string | null } {
  const unavailable = (reason: string) => ({ plan: null, reason });
  const { data } = snapshot;
  const duration = durations[data.interval];
  if (data.marketStatus.isOpen === false)
    return unavailable("The market is closed. A fresh actionable entry scenario is unavailable.");
  const policy = resolveEntryPolicy(options?.preferences ?? { interval: data.interval });
  if (!context || durations[context.data.interval] <= duration)
    return unavailable("A supported trend timeframe higher than the entry timeframe is required.");
  if (
    !Number.isFinite(Date.parse(data.timestamp)) ||
    Date.parse(data.timestamp) > now + 60_000 ||
    now - Date.parse(data.timestamp) > Math.max(duration * 2, 120_000)
  )
    return unavailable("The current price observation is stale or its timestamp is invalid.");
  const candles = data.candles.filter((candle) => Date.parse(candle.time) + duration <= now);
  const last = candles.at(-1);
  const previous = candles.at(-2);
  if (snapshot.freshness !== "fresh" || !last || !previous || now - Date.parse(last.time) > duration * 2)
    return unavailable("Fresh completed candles are required. Recheck when the market is open and data is current.");
  if (
    candles.some(
      (candle) =>
        candle.low > Math.min(candle.open, candle.close) ||
        candle.high < Math.max(candle.open, candle.close) ||
        candle.high < candle.low,
    )
  )
    return unavailable("Completed candle prices are inconsistent. No validated scenario is available.");
  if (candles.length < 50)
    return unavailable("Not enough completed candles for this scenario's trend and volatility checks.");
  if (candles.some((candle, index) => index > 0 && Date.parse(candle.time) <= Date.parse(candles[index - 1].time)))
    return unavailable("The candle order could not be validated.");
  if (
    candles
      .slice(-50)
      .some(
        (candle, index, window) =>
          index > 0 && Date.parse(candle.time) - Date.parse(window[index - 1].time) !== duration,
      )
  )
    return unavailable("Recent completed candles contain gaps. A continuous window is required for this entry rule.");
  const indicators = calculateTechnicalIndicators(candles);
  if (!indicators.atr || !indicators.sma50) return unavailable("Volatility or moving-average context is unavailable.");
  const direction = requested === "AUTO" ? (last.close >= indicators.sma50 ? "BUY" : "SELL") : requested;
  const buy = direction === "BUY";
  if (context) {
    const contextCandles = context.data.candles.filter(
      (candle) => Date.parse(candle.time) + durations[context.data.interval] <= now,
    );
    const contextAverage = calculateTechnicalIndicators(contextCandles).sma50;
    const contextClose = contextCandles.at(-1)?.close;
    if (
      context.freshness !== "fresh" ||
      !contextAverage ||
      !contextClose ||
      contextCandles.length < 50 ||
      now - Date.parse(contextCandles.at(-1)!.time) > durations[context.data.interval] * 2
    )
      return unavailable("Higher-timeframe context is unavailable. Recheck before forming a plan.");
    if (buy ? contextClose < contextAverage : contextClose > contextAverage)
      return unavailable(
        "The entry timeframe and higher-timeframe trend disagree. Wait for alignment rather than forcing a direction.",
      );
  }
  const scenario = policy.scenario === "auto" ? (options?.scenario ?? "breakout") : policy.scenario;
  const condition =
    policy.condition === "auto"
      ? (options?.condition ?? (scenario === "pullback" ? "break_retest" : "candle_close"))
      : policy.condition;
  if (scenario === "breakout" && condition === "touch")
    return unavailable(
      "A breakout requires a completed-candle close or a later break and retest; touch alone is unsupported.",
    );
  const range = scenario === "pullback" ? candles.slice(-50, -6) : candles.slice(-21, -1);
  const recent = candles.slice(-6);
  const pipSize = scenarioPipSize(data.symbol);
  const decimals = scenarioPriceDecimals(data.symbol);
  const round = (value: number) => Number(value.toFixed(decimals));
  const entry = round(
    buy ? Math.max(...range.map((candle) => candle.high)) : Math.min(...range.map((candle) => candle.low)),
  );
  const stopLoss = round(
    buy
      ? Math.min(...recent.map((candle) => candle.low)) - indicators.atr * 0.25
      : Math.max(...recent.map((candle) => candle.high)) + indicators.atr * 0.25,
  );
  const maxEntryDistance = indicators.atr * 1.5;
  if (Math.abs(data.price - entry) > maxEntryDistance)
    return unavailable(
      "Price is too far from the structural entry (more than one and a half ATR). No timely entry plan is available.",
    );
  const observedBreak = candles
    .slice(-6, -1)
    .filter((candle) => (buy ? candle.close > entry : candle.close < entry))
    .at(-1);
  if (scenario === "pullback" && !observedBreak)
    return unavailable(
      "A pullback needs an observed completed-candle break of the prior range. That evidence is missing.",
    );
  const risk = Math.abs(entry - stopLoss);
  if (risk <= 0 || risk / entry > 0.1 || stopLoss <= 0 || (buy ? stopLoss >= entry : stopLoss <= entry))
    return unavailable("The current range cannot form an ordered scenario with a bounded stop distance.");
  if (buy ? data.price <= stopLoss : data.price >= stopLoss)
    return unavailable("The observed price has already invalidated this scenario.");
  if (
    scenario === "breakout" &&
    (buy ? data.price > entry + indicators.atr * 0.25 : data.price < entry - indicators.atr * 0.25)
  )
    return unavailable(
      "Price has moved beyond this entry area. Recheck for a new pullback instead of chasing the move.",
    );
  const pullback = recent
    .slice(1, -1)
    .some((candle, index) => (buy ? candle.close < recent[index].close : candle.close > recent[index].close));
  const crossed = buy ? previous.close <= entry && last.close > entry : previous.close >= entry && last.close < entry;
  const stage = pullback && crossed ? "confirmed" : pullback ? "waiting_reclaim" : "waiting_pullback";
  const levels = calculateSupportResistance(candles);
  const contextLevels = context
    ? calculateSupportResistance(
        context.data.candles.filter((candle) => Date.parse(candle.time) + durations[context.data.interval] <= now),
      )
    : null;
  const candidates = buy
    ? [...levels.resistance, ...(contextLevels?.resistance ?? [])]
    : [...levels.support, ...(contextLevels?.support ?? [])];
  const targets = [...new Set(candidates.map(round))]
    .filter((target) => (buy ? target > entry : target < entry) && Math.abs(target - entry) >= risk * 0.5)
    .sort((a, b) => (buy ? a - b : b - a))
    .slice(0, 3);
  if (!targets.length)
    return unavailable(
      "No supported target beyond Entry offers a meaningful reward relative to the stop distance. Wait for a clearer structure.",
    );
  if (targets.some((target) => target <= 0)) return unavailable("Risk-based targets fall outside a valid price range.");
  const validityCandles =
    policy.validityMode === "manual"
      ? policy.validityCandles
      : (options?.validityCandles ?? (scenario === "pullback" ? 5 : 3));
  if (validityCandles < 1 || validityCandles > 12 || duration * validityCandles > 72 * 3_600_000)
    return unavailable("Entry validity must be one to twelve entry candles and no longer than seventy-two hours.");
  const capital = options?.preferences.capital ?? null;
  const quote = data.symbol.split("-").at(-1)!;
  const riskAmount = capital ? (capital * options!.preferences.riskPercent) / 100 : null;
  const baseUnits = riskAmount && options?.preferences.currency === quote ? riskAmount / risk : null;
  const plan = TradeSetupSchema.parse({
    conditionalEntry: {
      version: 2,
      scenario,
      condition,
      trendInterval: context.data.interval,
      timeframeMode: policy.timeframeMode,
      validityMode: policy.validityMode,
      validityCandles,
      breakoutAt:
        scenario === "pullback" && observedBreak
          ? new Date(Date.parse(observedBreak.time) + duration).toISOString()
          : null,
      proposedAt: new Date(now).toISOString(),
      rationale:
        options?.rationale ??
        (scenario === "pullback"
          ? "Prior range break observed on completed candles; trend alignment and a bounded ATR distance support a conditional pullback."
          : "Prior completed-candle range boundary with aligned higher-timeframe trend; a future close or break and retest is required."),
      validityReason:
        policy.validityMode === "manual"
          ? "User-selected entry candle count, validated against the twelve-candle and seventy-two-hour limits. Independent of holding style."
          : (options?.validityReason ??
            "Bounded proposed candle count, validated against fresh structure and ATR distance. This is only the deadline for an unexecuted entry."),
      invalidation: { kind: "stop_before_entry", price: stopLoss },
      atr: indicators.atr,
      maxEntryDistance,
      news: options?.news ?? {
        status: "unavailable",
        latestPublishedAt: null,
        checkedAt: new Date(now).toISOString(),
        sourceIds: [],
        calendar: "unavailable",
      },
      executionData: { spread: "unavailable", fees: "unavailable", liquidity: "unavailable" },
      sizing: {
        capitalBasis: "user_supplied",
        riskAmount,
        baseUnits,
        reason: baseUnits
          ? "Indicative base units from manually supplied capital, risk and entry-stop distance. Simulation fees are zero unless supplied."
          : capital
            ? "Account and quote currencies differ; verified conversion is unavailable."
            : "Manual capital was not supplied; size is unknown.",
      },
    },
    symbol: data.symbol,
    interval: data.interval,
    direction,
    stage,
    entry,
    stopLoss,
    targets,
    targetBasis: "Observed support/resistance beyond entry, ordered by distance; not price predictions.",
    ...(context ? { contextInterval: context.data.interval } : {}),
    observedPrice: data.price,
    observedAt: data.timestamp,
    expiresAt: new Date(now + duration * validityCandles).toISOString(),
    quote: data.symbol.split("-")[1],
    pipSize,
    sourceId,
  });
  return { plan, reason: null };
}
