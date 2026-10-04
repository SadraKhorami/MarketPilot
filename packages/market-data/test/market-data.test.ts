import assert from "node:assert/strict";
import test from "node:test";

import {
	calculateSupportResistance,
	calculateStructuralLevels,
	articleMatchesAsset,
	calculateTechnicalIndicators,
	calculateTrend,
	CoinbaseExchangeProvider,
	MarketDataProviderError,
	type MarketCandle,
} from "../src";

function makeCandles(count: number): MarketCandle[] {
	return Array.from({ length: count }, (_, index) => {
		const close = index + 1;
		return {
			time: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
			open: close - 0.25,
			high: close + 1,
			low: close - 1,
			close,
			volume: 10,
		};
	});
}

test("calculates indicators from ordered candles and reports trend only with enough history", () => {
	const candles = makeCandles(220);
	const indicators = calculateTechnicalIndicators(candles);

	assert.equal(indicators.rsi, 100);
	assert.equal(indicators.sma50, 195.5);
	assert.equal(indicators.sma200, 120.5);
	assert.ok(indicators.macd);
	assert.ok(indicators.bollingerBands);
	assert.ok(indicators.stochastic);
	assert.ok(indicators.atr);
	assert.equal(calculateTrend(220, indicators), "uptrend");
	assert.deepEqual(calculateSupportResistance(candles).support.length, 2);
	assert.equal(
		calculateTrend(15, calculateTechnicalIndicators(makeCandles(20))),
		null,
	);
});

test("Coinbase adapter normalizes response shape, ordering, and the provider interval", async () => {
	const newest = 1_800_000_900;
	const seen: URL[] = [];
	const fetcher: typeof fetch = async (input) => {
		const url = new URL(String(input));
		seen.push(url);
		if (url.pathname.endsWith("/ticker")) {
			return Response.json({
				price: "102.50",
				time: "2026-09-29T21:44:28.091Z",
			});
		}
		return Response.json([
			[newest, 101, 104, 102, 103, 5],
			[newest - 900, 99, 103, 100, 102, 7],
		]);
	};

	const observation = await new CoinbaseExchangeProvider(fetcher).getMarketData(
		"btc-usd",
		"15m",
	);

	assert.equal(observation.symbol, "BTC-USD");
	assert.equal(observation.providerSymbol, "BTC-USD");
	assert.equal(observation.price, 102.5);
	assert.equal(observation.candles.length, 2);
	assert.ok(observation.candles[0].time < observation.candles[1].time);
	assert.equal(
		seen
			.find((url) => url.pathname.endsWith("/candles"))
			?.searchParams.get("granularity"),
		"900",
	);
});

test("Coinbase adapter rejects aliases that could silently change the quote currency", async () => {
	let requestCount = 0;
	const provider = new CoinbaseExchangeProvider(async () => {
		requestCount++;
		return Response.json({});
	});

	await assert.rejects(
		() => provider.getMarketData("BTCUSDT", "15m"),
		(error: unknown) =>
			error instanceof MarketDataProviderError &&
			error.code === "INVALID_SYMBOL",
	);
	assert.equal(requestCount, 0);
});

test("Coinbase adapter rejects inconsistent OHLC candle values", async () => {
	const provider = new CoinbaseExchangeProvider(async (input) => {
		if (String(input).includes("/ticker")) {
			return Response.json({ price: "100", time: "2026-09-29T21:44:28.091Z" });
		}
		return Response.json([[1_800_000_900, 100, 99, 100, 101, 5]]);
	});

	await assert.rejects(
		() => provider.getMarketData("BTC-USD", "15m"),
		(error: unknown) =>
			error instanceof MarketDataProviderError &&
			error.code === "INVALID_RESPONSE",
	);
});

test("asset news matches whole names or explicit tags, not substrings such as oversold", () => {
	const article = (title: string, affectedAssets: string[] = []) => ({
		title,
		affectedAssets,
		description: null,
	});
	assert.equal(
		articleMatchesAsset(
			article("Crude Oil WTI in oversold standoff"),
			"SOL-USD",
		),
		false,
	);
	assert.equal(
		articleMatchesAsset(article("SOL-USD rallies"), "SOL-USD"),
		true,
	);
	assert.equal(
		articleMatchesAsset(article("Solana network news"), "SOL-USD"),
		true,
	);
	assert.equal(
		articleMatchesAsset(article("Consolidation news"), "SOL-USD"),
		false,
	);
	assert.equal(
		articleMatchesAsset(article("خبر سولانا امروز"), "SOL-USD"),
		true,
	);
	assert.equal(
		articleMatchesAsset(article("Network news", ["SOL"]), "SOL-USD"),
		true,
	);
	assert.equal(
		articleMatchesAsset(article("Ethernet hardware"), "ETH-USD"),
		false,
	);
});

test("structural levels use confirmed wick pivots, without inventing levels in a monotonic trend", () => {
	const candles = makeCandles(7).map((candle, index) => ({
		...candle,
		open: 8,
		close: 8,
		high: [10, 11, 15, 12, 11, 13, 16][index],
		low: [5, 4, 2, 3, 4, 3, 1][index],
	}));
	assert.deepEqual(calculateStructuralLevels(candles), {
		support: [2],
		resistance: [15],
	});
	assert.deepEqual(calculateStructuralLevels(candles.slice(0, 4)), {
		support: [],
		resistance: [],
	});
	assert.deepEqual(calculateStructuralLevels(makeCandles(20)), {
		support: [],
		resistance: [],
	});
	assert.deepEqual(
		calculateStructuralLevels([
			...candles.slice(0, 6),
			{ ...candles[6], close: 16, open: 15 },
		]),
		{
			support: [2],
			resistance: [],
		},
	);
	assert.deepEqual(
		calculateStructuralLevels([
			...candles.slice(0, 6),
			{ ...candles[6], close: 1, open: 2 },
		]),
		{
			support: [],
			resistance: [15],
		},
	);
});
