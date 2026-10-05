import assert from "node:assert/strict";
import test from "node:test";
import {
	aggregateSixHourCandles,
	aggregateSixHourHistory,
} from "../src/six-hour-candles";
import { type MarketCandle, MarketDataProviderError } from "../src/types";

const hour = 3_600_000;
const start = Date.parse("2026-10-05T00:00:00Z");
function bar(time: number, index = 0): MarketCandle {
	return {
		time: new Date(time).toISOString(),
		open: 100 + index,
		high: 102 + index,
		low: 98 + index,
		close: 101 + index,
		volume: 10,
	};
}
function hourly(count: number, from = start) {
	return Array.from({ length: count }, (_, index) =>
		bar(from + index * hour, index),
	);
}
function invalid(callback: () => unknown) {
	assert.throws(
		callback,
		(error: unknown) =>
			error instanceof MarketDataProviderError &&
			error.code === "INVALID_RESPONSE",
	);
}
test("aggregates exact observed OHLC and volume into UTC six-hour boundaries", () => {
	const result = aggregateSixHourCandles(
		hourly(12),
		"BTC-USD",
		start + 12 * hour,
	);
	assert.equal(result.length, 2);
	assert.deepEqual(result[0], {
		time: new Date(start).toISOString(),
		open: 100,
		high: 107,
		low: 98,
		close: 106,
		volume: 60,
	});
	assert.equal(result[1].time, new Date(start + 6 * hour).toISOString());
});
test("a forming bucket stays distinguishable from completed six-hour history", () => {
	const observedAt = start + 7.5 * hour;
	const result = aggregateSixHourCandles(hourly(8), "BTC-USD", observedAt);
	assert.equal(result.length, 2);
	assert.equal(
		result.filter((candle) => Date.parse(candle.time) + 6 * hour <= observedAt)
			.length,
		1,
	);
	assert.equal(result[1].close, 108);
});
test("excludes a clipped left edge instead of publishing an incomplete closed candle", () => {
	const result = aggregateSixHourCandles(
		hourly(11, start + hour),
		"BTC-USD",
		start + 12 * hour,
	);
	assert.equal(result.length, 1);
	assert.equal(result[0].time, new Date(start + 6 * hour).toISOString());
});
test("does not bridge missing trading hours and keeps only the subsequent continuous history", () => {
	const data = hourly(12);
	data.splice(2, 1);
	const result = aggregateSixHourHistory(data, "BTC-USD", start + 12 * hour);
	assert.equal(result.historyTruncated, true);
	assert.equal(result.candles.length, 1);
	assert.equal(
		result.candles[0].time,
		new Date(start + 6 * hour).toISOString(),
	);
	const latestMissing = hourly(6).filter((_, index) => index !== 2);
	invalid(() =>
		aggregateSixHourCandles(latestMissing, "BTC-USD", start + 6 * hour),
	);
});
test("allows known OANDA gold weekend closure without filling prices or volume", () => {
	const times = [
		"2026-10-02T18:00:00Z",
		"2026-10-02T19:00:00Z",
		"2026-10-02T20:00:00Z",
		"2026-10-04T22:00:00Z",
		"2026-10-04T23:00:00Z",
		...Array.from({ length: 6 }, (_, index) => `2026-10-05T0${index}:00:00Z`),
	];
	const data = times.map((time, index) => bar(Date.parse(time), index));
	const result = aggregateSixHourCandles(
		data,
		"OANDA:XAUUSD",
		start + 6 * hour,
	);
	assert.equal(result.length, 3);
	assert.equal(result[0].volume, 30);
	assert.equal(result[0].close, data[2].close);
	assert.equal(result[1].time, "2026-10-04T18:00:00.000Z");
	assert.equal(result[1].open, data[3].open);
	assert.equal(result[1].volume, 20);
	const withGap = aggregateSixHourHistory(
		data.filter((candle) => candle.time !== "2026-10-04T22:00:00.000Z"),
		"OANDA:XAUUSD",
		start + 6 * hour,
	);
	assert.equal(withGap.historyTruncated, true);
	assert.equal(withGap.candles[0].time, new Date(start).toISOString());
});
test("gold session reopening follows New York daylight saving, while buckets stay UTC aligned", () => {
	const times = [
		"2026-11-01T23:00:00Z",
		...Array.from({ length: 6 }, (_, index) => `2026-11-02T0${index}:00:00Z`),
	];
	const result = aggregateSixHourCandles(
		times.map((time) => bar(Date.parse(time))),
		"OANDA:XAUUSD",
		Date.parse("2026-11-02T06:00:00Z"),
	);
	assert.equal(result.length, 2);
	assert.equal(result[0].time, "2026-11-01T18:00:00.000Z");
	assert.equal(result[0].volume, 10);
});
test("rejects duplicates, unordered bars, malformed OHLC and misaligned hours", () => {
	const data = hourly(12);
	invalid(() =>
		aggregateSixHourCandles([data[0], ...data], "BTC-USD", start + 12 * hour),
	);
	invalid(() =>
		aggregateSixHourCandles([...data].reverse(), "BTC-USD", start + 12 * hour),
	);
	invalid(() =>
		aggregateSixHourCandles(
			[{ ...data[0], high: 1 }, ...data.slice(1)],
			"BTC-USD",
			start + 12 * hour,
		),
	);
	invalid(() =>
		aggregateSixHourCandles(
			[
				{ ...data[0], time: new Date(start + 1).toISOString() },
				...data.slice(1),
			],
			"BTC-USD",
			start + 12 * hour,
		),
	);
});
test("keeps unknown volume unknown instead of inventing a six-hour total", () => {
	const data = hourly(6);
	data[2].volume = null;
	assert.equal(
		aggregateSixHourCandles(data, "BTC-USD", start + 6 * hour)[0].volume,
		null,
	);
});
test("bounds output to the latest 300 six-hour candles after constructing the full history", () => {
	const data = hourly(1806);
	const result = aggregateSixHourCandles(data, "BTC-USD", start + 1806 * hour);
	assert.equal(result.length, 300);
	assert.equal(result[0].time, new Date(start + 6 * hour).toISOString());
});

test("bounds work on unexpectedly distant provider timestamps", () => {
	const future = start + 200 * 86_400_000;
	invalid(() =>
		aggregateSixHourCandles(
			[bar(start), bar(future)],
			"BTC-USD",
			future + hour,
		),
	);
});
