import { expectedInstrument, intervalSeconds, jobConfig } from "@marketpilot/jobs";
import {
  calculateTechnicalIndicators,
  type MarketDataInterval,
  MarketObservationSchema,
} from "@marketpilot/market-data";

export type ValidMetric = {
  value: number;
  observationAt: Date;
  source: string;
  providerSymbol: string;
  priceKind: string;
  unit: string;
};
export function metricFromObservation(
  payload: unknown,
  symbol: string,
  interval: string,
  condition: string,
  fetchedAt: Date,
): ValidMetric | string {
  const config = jobConfig();
  const parsed = MarketObservationSchema.safeParse(payload);
  if (!parsed.success) return "INVALID_OBSERVATION";
  const data = parsed.data;
  const expected = expectedInstrument(symbol);
  if (
    data.symbol !== symbol ||
    data.providerSymbol !== expected.providerSymbol ||
    data.source !== expected.source ||
    data.interval !== interval
  )
    return "INSTRUMENT_MISMATCH";
  const now = Date.now();
  if (fetchedAt.getTime() > now + 5000 || now - fetchedAt.getTime() > config.snapshotMaxAgeMs) return "STALE_SNAPSHOT";
  const duration = intervalSeconds[data.interval];
  // Only completed bars contribute to technical metrics and candle-close prices.
  const candles = data.candles.filter((candle) => Date.parse(candle.time) + duration * 1000 <= now);
  if (
    data.candles.some(
      (candle, index, bars) =>
        candle.high < Math.max(candle.open, candle.close, candle.low) ||
        candle.low > Math.min(candle.open, candle.close) ||
        Date.parse(candle.time) > now + 5000 ||
        (index > 0 && candle.time <= bars[index - 1].time),
    )
  )
    return "INVALID_CANDLES";
  const latest = candles.at(-1);
  if (!latest) return "MISSING_CANDLES";
  const technicalAt = Date.parse(latest.time) + duration * 1000;
  if (now - technicalAt > duration * 1000 + config.quoteMaxAgeMs) return "STALE_CANDLES";
  let value: number | null = null;
  let observationAt = new Date(technicalAt);
  let unit = expected.quote;
  let priceKind = "candle_close";
  if (condition.startsWith("PRICE_")) {
    if (data.priceKind === "quote" && expected.source === "coinbase-exchange") {
      observationAt = new Date(data.timestamp);
      if (observationAt.getTime() > now + 5000 || now - observationAt.getTime() > config.quoteMaxAgeMs)
        return "STALE_QUOTE";
      value = data.price;
      priceKind = "quote";
    } else if (data.priceKind === "candle_close" && expected.source === "tradingview") value = latest.close;
    else return "INVALID_PRICE_KIND";
  } else if (condition.startsWith("RSI_")) {
    value = calculateTechnicalIndicators(candles).rsi;
    unit = "RSI (0–100)";
  } else if (condition.startsWith("PERCENT_CHANGE_")) {
    const previous = candles.at(-2);
    if (!previous || technicalAt - (Date.parse(previous.time) + duration * 1000) !== duration * 1000)
      return "MISSING_CHANGE_BASELINE";
    value = (latest.close / previous.close - 1) * 100;
    unit = "% per candle";
  } else return "UNSUPPORTED_CONDITION";
  if (
    value === null ||
    !Number.isFinite(value) ||
    Math.abs(value) >= 1e14 ||
    (condition.startsWith("PRICE_") && value < 1e-10)
  )
    return "MISSING_OR_INVALID_METRIC";
  return {
    value,
    observationAt,
    source: expected.source,
    providerSymbol: expected.providerSymbol,
    priceKind,
    unit,
  };
}
export function isInterval(value: string): value is MarketDataInterval {
  return Object.hasOwn(intervalSeconds, value);
}
