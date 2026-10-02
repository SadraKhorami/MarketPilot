import { TradeSetupSchema, type TradeSetup } from "@marketpilot/ai";
import { calculateSupportResistance, calculateTechnicalIndicators, referenceMarkets } from "@marketpilot/market-data";
import type { MarketSnapshot } from "../market-data/market-data.service";

const durations = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "6h": 21_600_000, "1d": 86_400_000 };

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
): { plan: TradeSetup | null; reason: string | null } {
  const unavailable = (reason: string) => ({ plan: null, reason });
  const { data } = snapshot;
  const duration = durations[data.interval];
  const candles = data.candles.filter((candle) => Date.parse(candle.time) + duration <= now);
  const last = candles.at(-1);
  const previous = candles.at(-2);
  if (snapshot.freshness !== "fresh" || !last || !previous || now - Date.parse(last.time) > duration * 2)
    return unavailable("Fresh completed candles are required. Recheck when the market is open and data is current.");
  if (candles.length < 50)
    return unavailable("Not enough completed candles for this scenario's trend and volatility checks.");
  if (candles.some((candle, index) => index > 0 && Date.parse(candle.time) <= Date.parse(candles[index - 1].time)))
    return unavailable("The candle order could not be validated.");
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
    if (context.freshness !== "fresh" || !contextAverage || !contextClose)
      return unavailable("Higher-timeframe context is unavailable. Recheck before forming a plan.");
    if (buy ? contextClose < contextAverage : contextClose > contextAverage)
      return unavailable(
        "The entry timeframe and higher-timeframe trend disagree. Wait for alignment rather than forcing a direction.",
      );
  }
  const range = candles.slice(-21, -1);
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
  const risk = Math.abs(entry - stopLoss);
  if (risk <= 0 || risk / entry > 0.1 || stopLoss <= 0)
    return unavailable("The current range cannot form an ordered scenario with a bounded stop distance.");
  if (buy ? data.price <= stopLoss : data.price >= stopLoss)
    return unavailable("The observed price has already invalidated this scenario.");
  if (buy ? data.price > entry + indicators.atr * 0.25 : data.price < entry - indicators.atr * 0.25)
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
  const plan = TradeSetupSchema.parse({
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
    expiresAt: new Date(now + Math.max(10 * 60_000, duration * 3)).toISOString(),
    quote: data.symbol.split("-")[1],
    pipSize,
    sourceId,
  });
  return { plan, reason: null };
}
