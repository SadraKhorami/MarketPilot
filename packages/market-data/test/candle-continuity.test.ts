import assert from "node:assert/strict";
import { test } from "node:test";
import {
	completedCandleIsCurrent,
	hasUnexpectedCandleGaps,
} from "../src/candle-continuity";

const candles = (...times: string[]) =>
	times.map((time) => ({
		time,
		open: 10,
		high: 11,
		low: 9,
		close: 10,
		volume: 1,
	}));
const gold = "OANDA:XAUUSD";

test("gold weekend closure is continuous in trading time for 15m and 1h", () => {
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-02T20:45:00Z", "2026-10-04T22:00:00Z"),
			900_000,
			gold,
		),
		false,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-02T20:00:00Z", "2026-10-04T22:00:00Z"),
			3_600_000,
			gold,
		),
		false,
	);
});
test("daily closure is allowed but the partially open reopening bucket is required", () => {
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-01T20:00:00Z", "2026-10-01T22:00:00Z"),
			3_600_000,
			gold,
		),
		false,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-01T20:00:00Z", "2026-10-01T23:00:00Z"),
			3_600_000,
			gold,
		),
		true,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-02T20:45:00Z", "2026-10-04T22:15:00Z"),
			900_000,
			gold,
		),
		true,
	);
});
test("real missing bars and irregular candle boundaries remain rejected", () => {
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-05T08:00:00Z", "2026-10-05T08:30:00Z"),
			900_000,
			gold,
		),
		true,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-05T08:00:00Z", "2026-10-05T08:16:00Z"),
			900_000,
			gold,
		),
		true,
	);
});
test("exchange daylight saving transition and winter hours are respected", () => {
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-30T20:00:00Z", "2026-11-01T23:00:00Z"),
			3_600_000,
			gold,
		),
		false,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-11-05T21:00:00Z", "2026-11-05T23:00:00Z"),
			3_600_000,
			gold,
		),
		false,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-11-05T20:00:00Z", "2026-11-05T23:00:00Z"),
			3_600_000,
			gold,
		),
		true,
	);
});
test("silver shares its documented session; crypto and unknown sources stay strict", () => {
	const weekend = candles("2026-10-02T20:00:00Z", "2026-10-04T22:00:00Z");
	assert.equal(
		hasUnexpectedCandleGaps(weekend, 3_600_000, "OANDA:XAGUSD"),
		false,
	);
	assert.equal(hasUnexpectedCandleGaps(weekend, 3_600_000, "BTC-USD"), true);
	assert.equal(
		hasUnexpectedCandleGaps(weekend, 3_600_000, "OTHER:XAUUSD"),
		true,
	);
});

test("WTI and Brent sessions preserve genuine open-market gaps", () => {
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-02T20:00:00Z", "2026-10-04T22:00:00Z"),
			3_600_000,
			"OANDA:WTICOUSD",
		),
		false,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-01T20:00:00Z", "2026-10-01T22:00:00Z"),
			3_600_000,
			"OANDA:WTICOUSD",
		),
		false,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-02T20:00:00Z", "2026-10-04T22:00:00Z"),
			3_600_000,
			"OANDA:BCOUSD",
		),
		false,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-05T21:00:00Z", "2026-10-06T00:00:00Z"),
			3_600_000,
			"OANDA:BCOUSD",
		),
		false,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-05T08:00:00Z", "2026-10-05T10:00:00Z"),
			3_600_000,
			"OANDA:BCOUSD",
		),
		true,
	);
});

test("daily gold history excludes fully closed weekend buckets and respects DST", () => {
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-01T21:00:00Z", "2026-10-04T21:00:00Z"),
			86_400_000,
			gold,
		),
		false,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-29T21:00:00Z", "2026-11-01T22:00:00Z"),
			86_400_000,
			gold,
		),
		false,
	);
	assert.equal(
		hasUnexpectedCandleGaps(
			candles("2026-10-01T21:00:00Z", "2026-10-05T21:00:00Z"),
			86_400_000,
			gold,
		),
		true,
	);
});

test("completed daily candles stay current through scheduled closures but not missing sessions", () => {
	assert.equal(
		completedCandleIsCurrent(
			"2026-10-01T21:00:00Z",
			Date.parse("2026-10-05T10:00:00Z"),
			86_400_000,
			gold,
		),
		true,
	);
	assert.equal(
		completedCandleIsCurrent(
			"2026-10-01T21:00:00Z",
			Date.parse("2026-10-05T10:00:00Z"),
			86_400_000,
			"BTC-USD",
		),
		false,
	);
	assert.equal(
		completedCandleIsCurrent(
			"2026-10-01T21:00:00Z",
			Date.parse("2026-10-06T10:00:00Z"),
			86_400_000,
			gold,
		),
		false,
	);
	assert.equal(
		completedCandleIsCurrent("invalid", Date.now(), 86_400_000, gold),
		false,
	);
});
