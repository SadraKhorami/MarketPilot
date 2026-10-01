import { expectedInstrument, intervalSeconds } from "@marketpilot/jobs";
import { calculateTechnicalIndicators, calculateTrend, MarketObservationSchema } from "@marketpilot/market-data";
import type { MarketSnapshot } from "../market-data/market-data.service";
export function formatBotPrice(snapshot: MarketSnapshot, symbol: string) {
  const data = MarketObservationSchema.parse(snapshot.data);
  const expected = expectedInstrument(symbol);
  const now = Date.now();
  const fetched = Date.parse(snapshot.fetchedAt);
  const observed = Date.parse(data.timestamp);
  const duration = intervalSeconds[data.interval] * 1000;
  if (
    snapshot.requestedSymbol !== symbol ||
    data.symbol !== symbol ||
    data.providerSymbol !== expected.providerSymbol ||
    snapshot.source !== expected.source ||
    data.source !== expected.source ||
    data.interval !== "15m" ||
    !Number.isFinite(fetched) ||
    fetched > now + 5000 ||
    now - fetched > 900000 ||
    observed > now + 5000 ||
    (expected.source === "tradingview" ? data.priceKind !== "candle_close" : data.priceKind !== "quote")
  )
    throw new Error("COMMAND_OBSERVATION_INVALID");
  if (
    data.candles.some(
      (bar, index, bars) =>
        bar.high < Math.max(bar.open, bar.close, bar.low) ||
        bar.low > Math.min(bar.open, bar.close) ||
        Date.parse(bar.time) > now + 5000 ||
        (index > 0 && bar.time <= bars[index - 1].time),
    )
  )
    throw new Error("COMMAND_OBSERVATION_INVALID");
  const completed = data.candles.filter((bar) => Date.parse(bar.time) + duration <= now);
  const latest = completed.at(-1);
  if (!latest || (data.priceKind === "candle_close" && (data.price !== latest.close || data.timestamp !== latest.time)))
    throw new Error("COMMAND_OBSERVATION_INVALID");
  const indicators = calculateTechnicalIndicators(completed);
  const age = now - (data.priceKind === "candle_close" ? observed + duration : observed);
  const freshObservation = age <= (data.priceKind === "candle_close" ? duration + 120000 : 120000);
  return `📊 ${symbol} · Market snapshot\n\nPrice: ${data.price.toLocaleString("en-US", { maximumFractionDigits: 8 })} ${expected.quote}\n${data.priceKind === "candle_close" ? `Completed candle close · bar opened ${formatTime(data.timestamp)}` : `Provider quote · observed ${formatTime(data.timestamp)}`}\nInterval: 15m · retrieved ${formatTime(snapshot.fetchedAt)}\n\nSource: ${snapshot.source} · ${data.providerSymbol}\nCache: ${snapshot.freshness} · observation: ${freshObservation ? "recent" : "older; may be a closed or inactive market"}\n\nTechnical interpretation\nRSI: ${indicators.rsi?.toFixed(2) ?? "Unavailable"}\nTrend: ${calculateTrend(latest.close, indicators) ?? "Unavailable"}\nCalculation history: ${completed.length} completed candles`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}
