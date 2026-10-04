import {
  assessTradeEconomics,
  type ConditionalEntry,
  conditionalEntryStage,
  describeEntryCondition,
  entryDeadline,
  entryDurations,
  resolveEntryPolicy,
  sizeUnleveragedTrade,
  type TradePreferences,
  type TradeSetup,
  TradeSetupSchema,
} from "@marketpilot/ai";
import { calculateStructuralLevels, calculateTechnicalIndicators, referenceMarkets } from "@marketpilot/market-data";
import type { MarketSnapshot } from "../market-data/market-data.service";
import { completedSnapshotCandles } from "./market-evidence";

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
  const candles = completedSnapshotCandles(snapshot, now);
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
  if (buy ? last.close < indicators.sma50 : last.close > indicators.sma50)
    return unavailable(
      "The requested direction conflicts with the completed entry-timeframe trend. Wait for alignment.",
    );
  if (context) {
    const contextCandles = completedSnapshotCandles(context, now);
    if (
      contextCandles
        .slice(-50)
        .some(
          (candle, index, window) =>
            index > 0 &&
            Date.parse(candle.time) - Date.parse(window[index - 1].time) !== durations[context.data.interval],
        )
    )
      return unavailable("Recent higher-timeframe candles contain gaps. Trend alignment cannot be validated.");
    const contextAverage = calculateTechnicalIndicators(contextCandles).sma50;
    const contextLast = contextCandles.at(-1);
    const contextClose = contextLast?.close;
    if (
      context.freshness !== "fresh" ||
      !contextAverage ||
      !contextClose ||
      !contextLast ||
      contextCandles.length < 50 ||
      now - Date.parse(contextLast.time) > durations[context.data.interval] * 2
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
  const levels = calculateStructuralLevels(candles);
  const contextLevels = context ? calculateStructuralLevels(completedSnapshotCandles(context, now)) : null;
  const candidates = buy
    ? [...levels.resistance, ...(contextLevels?.resistance ?? [])]
    : [...levels.support, ...(contextLevels?.support ?? [])];
  const targets = [...new Set(candidates.map(round))]
    .filter((target) => (buy ? target > entry : target < entry))
    .sort((a, b) => (buy ? a - b : b - a))
    .slice(0, 3);
  if (!targets.length)
    return unavailable(
      "No confirmed historical swing target exists beyond Entry. Wait for an observed level; price extensions are not invented.",
    );
  if (targets.some((target) => target <= 0)) return unavailable("Risk-based targets fall outside a valid price range.");
  const validityCandles =
    policy.validityMode === "manual"
      ? policy.validityCandles
      : (options?.validityCandles ?? (scenario === "pullback" ? 5 : 3));
  if (validityCandles < 1 || validityCandles > 12 || duration * validityCandles > 72 * 3_600_000)
    return unavailable("Entry validity must be one to twelve entry candles and no longer than seventy-two hours.");
  const validityBasis = condition === "touch" ? "elapsed_duration" : "entry_candle_closes";
  const candleOffsetMs = Date.parse(last.time) % duration;
  const expiresAt = new Date(
    entryDeadline(now, data.interval, validityCandles, validityBasis, candleOffsetMs),
  ).toISOString();
  const breakoutAt =
    scenario === "pullback" && observedBreak ? new Date(Date.parse(observedBreak.time) + duration).toISOString() : null;
  const entryDescription = describeEntryCondition({
    interval: data.interval,
    direction,
    conditionalEntry: { scenario, condition },
  });
  const quality = assessTradeEconomics(
    { entry, stopLoss, targets, direction },
    policy.roundTripCostPercent,
    policy.minimumNetRewardRisk ?? 1.5,
  );
  if (!quality.accepted) return unavailable(quality.reason);
  const preferences = options?.preferences;
  const capital = preferences?.capital ?? null;
  const quote = data.symbol.split("-").at(-1);
  if (!quote) return unavailable("The market quote currency is unavailable.");
  const riskAmount = capital && preferences ? (capital * preferences.riskPercent) / 100 : null;
  const baseUnits =
    riskAmount && capital && preferences?.currency === quote
      ? sizeUnleveragedTrade(
          entry,
          quality.economics.stopRiskPerUnit,
          quality.economics.costPerUnit,
          capital,
          preferences.riskPercent,
        ).baseUnits
      : null;
  const plan = TradeSetupSchema.parse({
    conditionalEntry: {
      version: 2,
      scenario,
      condition,
      trendInterval: context.data.interval,
      timeframeMode: policy.timeframeMode,
      validityMode: policy.validityMode,
      validityCandles,
      validityBasis,
      candleOffsetMs,
      breakoutAt,
      proposedAt: new Date(now).toISOString(),
      rationale: `${data.symbol}: prior completed-candle range boundary, aligned ${context.data.interval} trend and entry within 1.5 ATR. Required: ${entryDescription}.`,
      validityReason: `${validityBasis === "entry_candle_closes" ? `${validityCandles} future ${data.interval} candle closes from proposal` : `${validityCandles} × ${data.interval} elapsed from proposal`}; deadline ${expiresAt}, inclusive. Entry is monitored only after saving. Stop touched before entry invalidates; expiry applies only while waiting.`,
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
      economics: quality.economics,
      sizing: {
        capitalBasis: "user_supplied",
        riskAmount,
        baseUnits,
        reason: baseUnits
          ? "Unleveraged position capped by supplied capital including estimated costs. Risk percentage is a maximum loss budget, not an investment amount."
          : capital
            ? "Account and quote currencies differ; verified conversion is unavailable."
            : "Manual capital was not supplied; size is unknown.",
      },
    },
    symbol: data.symbol,
    interval: data.interval,
    direction,
    stage: conditionalEntryStage({ scenario, condition, breakoutAt }),
    entry,
    stopLoss,
    targets,
    targetBasis: "Observed support/resistance beyond entry, ordered by distance; not price predictions.",
    ...(context ? { contextInterval: context.data.interval } : {}),
    observedPrice: data.price,
    observedAt: data.timestamp,
    expiresAt,
    quote: data.symbol.split("-")[1],
    pipSize,
    sourceId,
  });
  return { plan, reason: null };
}
