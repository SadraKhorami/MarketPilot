import { candleBucketHasTrading } from "./candle-continuity";
import { type MarketCandle, MarketDataProviderError } from "./types";

const hour = 3_600_000;
const sixHours = 6 * hour;

/** Derived UTC-aligned OHLC, never a claim to the provider's native custom resolution. */
export function aggregateSixHourHistory(
	hourly: readonly MarketCandle[],
	providerSymbol: string,
	observedAt: number,
): { candles: MarketCandle[]; historyTruncated: boolean } {
	const invalid = (message: string): never => {
		throw new MarketDataProviderError(message, "INVALID_RESPONSE");
	};
	if (!hourly.length || hourly.length > 1806 || !Number.isFinite(observedAt))
		return invalid("Hourly candle observations are missing.");
	const byTime = new Map<number, MarketCandle>();
	let previous = -Infinity;
	for (const candle of hourly) {
		const time = Date.parse(candle.time);
		if (
			!Number.isFinite(time) ||
			time % hour !== 0 ||
			time <= previous ||
			time > observedAt ||
			![candle.open, candle.high, candle.low, candle.close].every(
				(value) => Number.isFinite(value) && value > 0,
			) ||
			candle.low > Math.min(candle.open, candle.close) ||
			candle.high < Math.max(candle.open, candle.close) ||
			candle.high < candle.low ||
			(candle.volume !== null &&
				(!Number.isFinite(candle.volume) || candle.volume < 0))
		)
			return invalid(
				"Hourly candles cannot be validated for six-hour aggregation.",
			);
		previous = time;
		byTime.set(time, candle);
	}
	const first = Date.parse(hourly[0].time);
	const last = Date.parse(hourly[hourly.length - 1].time);
	const firstBucket = Math.floor(first / sixHours) * sixHours;
	const candles: MarketCandle[] = [];
	let historyTruncated = false;
	for (let start = firstBucket; start <= last; start += sixHours) {
		const bars: MarketCandle[] = [];
		let clipped = false;
		let missing = false;
		for (
			let time = start;
			time < start + sixHours && time <= observedAt;
			time += hour
		) {
			const bar = byTime.get(time);
			if (bar) {
				bars.push(bar);
			} else if (
				candleBucketHasTrading(
					time,
					Math.min(time + hour, observedAt + 1),
					providerSymbol,
				)
			) {
				if (start === firstBucket && time < first) clipped = true;
				else missing = true;
			}
		}
		// Never bridge an unclassified gap. Retain only the valid suffix after it.
		if (missing) {
			candles.length = 0;
			historyTruncated = true;
			continue;
		}
		// A truncated left edge is excluded, never promoted to a complete candle.
		if (clipped || !bars.length) continue;
		candles.push({
			time: new Date(start).toISOString(),
			open: bars[0].open,
			high: Math.max(...bars.map((bar) => bar.high)),
			low: Math.min(...bars.map((bar) => bar.low)),
			close: bars[bars.length - 1].close,
			volume: bars.some((bar) => bar.volume === null)
				? null
				: bars.reduce((sum, bar) => sum + (bar.volume ?? 0), 0),
		});
	}
	if (!candles.length)
		return invalid("No valid six-hour candle could be constructed.");
	return { candles: candles.slice(-300), historyTruncated };
}

export function aggregateSixHourCandles(
	hourly: readonly MarketCandle[],
	providerSymbol: string,
	observedAt: number,
) {
	return aggregateSixHourHistory(hourly, providerSymbol, observedAt).candles;
}
