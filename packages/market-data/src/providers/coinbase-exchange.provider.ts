import { z } from "zod";
import { type MarketInstrument, MarketInstrumentSchema } from "../catalog";
import {
	calculateSupportResistance,
	calculateTechnicalIndicators,
	calculateTrend,
	calculateVolatility,
} from "../indicators";
import {
	type MarketCandle,
	type MarketDataInterval,
	type MarketDataProvider,
	MarketDataProviderError,
	type MarketObservation,
	MarketObservationSchema,
} from "../types";

const API_BASE_URL = "https://api.exchange.coinbase.com";
const MAX_CANDLES = 300;
const INTERVAL_SECONDS: Record<MarketDataInterval, number> = {
	"1m": 60,
	"5m": 300,
	"15m": 900,
	"1h": 3600,
	"6h": 21_600,
	"1d": 86_400,
};

interface CoinbaseTicker {
	price: string;
	time: string;
}

export class CoinbaseExchangeProvider implements MarketDataProvider {
	readonly id = "coinbase-exchange";

	constructor(
		private readonly fetcher: typeof fetch = fetch,
		private readonly timeoutMs = 8_000,
	) {}

	async listMarkets(): Promise<MarketInstrument[]> {
		const [productsResult, currenciesResult] = await Promise.allSettled([
			this.request(`${API_BASE_URL}/products`),
			this.request(`${API_BASE_URL}/currencies`),
		]);
		if (productsResult.status === "rejected") throw productsResult.reason;
		const products = productsResult.value;
		const currencies =
			currenciesResult.status === "fulfilled" ? currenciesResult.value : [];
		const parsedProducts = z
			.array(
				z.object({
					id: z.string(),
					base_currency: z.string(),
					quote_currency: z.string(),
					status: z.string(),
					trading_disabled: z.boolean().optional(),
				}),
			)
			.safeParse(products);
		const parsedCurrencies = z
			.array(z.object({ id: z.string(), name: z.string() }))
			.safeParse(currencies);
		if (!parsedProducts.success)
			throw new MarketDataProviderError(
				"Market catalog could not be validated.",
				"INVALID_RESPONSE",
			);
		const names = new Map(
			(parsedCurrencies.success ? parsedCurrencies.data : []).map(
				(currency) => [currency.id, currency.name],
			),
		);
		return parsedProducts.data
			.filter(
				(product) => product.status === "online" && !product.trading_disabled,
			)
			.map((product) =>
				MarketInstrumentSchema.parse({
					symbol: product.id,
					name: names.get(product.base_currency) ?? product.base_currency,
					baseAsset: product.base_currency,
					quoteAsset: product.quote_currency,
					assetClass: "crypto",
					provider: this.id,
					providerSymbol: product.id,
					available: true,
				}),
			)
			.sort(
				(a, b) =>
					a.name.localeCompare(b.name) || a.symbol.localeCompare(b.symbol),
			);
	}

	async getMarketData(
		symbol: string,
		interval: MarketDataInterval,
	): Promise<MarketObservation> {
		const productId = normalizeProductId(symbol);
		const granularity = INTERVAL_SECONDS[interval];
		if (!granularity)
			throw new MarketDataProviderError(
				"The candle interval is unsupported.",
				"INVALID_SYMBOL",
			);

		const end = new Date();
		const start = new Date(end.getTime() - granularity * MAX_CANDLES * 1000);
		const candleUrl = new URL(
			`${API_BASE_URL}/products/${encodeURIComponent(productId)}/candles`,
		);
		candleUrl.searchParams.set("granularity", String(granularity));
		candleUrl.searchParams.set("start", start.toISOString());
		candleUrl.searchParams.set("end", end.toISOString());

		const [tickerPayload, candlePayload] = await Promise.all([
			this.request(
				`${API_BASE_URL}/products/${encodeURIComponent(productId)}/ticker`,
			),
			this.request(candleUrl),
		]);
		const ticker = parseTicker(tickerPayload);
		const candles = parseCandles(candlePayload);
		if (candles.length === 0) {
			throw new MarketDataProviderError(
				"The provider returned no candles for this product and interval.",
				"UNSUPPORTED_SYMBOL",
			);
		}

		const indicators = calculateTechnicalIndicators(candles);
		const observation = {
			symbol: productId,
			providerSymbol: productId,
			source: this.id,
			priceKind: "quote",
			interval,
			price: parsePositiveNumber(ticker.price),
			timestamp: parseTimestamp(ticker.time),
			candles,
			indicators,
			trend: calculateTrend(parsePositiveNumber(ticker.price), indicators),
			supportResistance: calculateSupportResistance(candles),
			marketStatus: { isOpen: true },
			volatility: calculateVolatility(
				indicators,
				parsePositiveNumber(ticker.price),
			),
		};
		const parsed = MarketObservationSchema.safeParse(observation);
		if (!parsed.success) {
			throw new MarketDataProviderError(
				"The provider observation failed validation.",
				"INVALID_RESPONSE",
			);
		}
		return parsed.data;
	}

	async getCandles(
		symbol: string,
		interval: MarketDataInterval,
		start: number,
		end: number,
	): Promise<MarketCandle[]> {
		const granularity = INTERVAL_SECONDS[interval];
		if (
			!Number.isFinite(start) ||
			!Number.isFinite(end) ||
			start >= end ||
			end - start > granularity * MAX_CANDLES * 1000
		)
			throw new MarketDataProviderError(
				"Historical candle range is invalid or exceeds one page.",
				"INVALID_RESPONSE",
			);
		const url = new URL(
			`${API_BASE_URL}/products/${encodeURIComponent(normalizeProductId(symbol))}/candles`,
		);
		url.searchParams.set("granularity", String(granularity));
		url.searchParams.set("start", new Date(start).toISOString());
		url.searchParams.set("end", new Date(end - 1).toISOString());
		return parseCandles(await this.request(url), { start, end });
	}

	private async request(url: string | URL): Promise<unknown> {
		let response: Response;
		try {
			response = await this.fetcher(url, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(this.timeoutMs),
				cache: "no-store",
			});
		} catch {
			throw new MarketDataProviderError(
				"The market-data provider could not be reached.",
				"UNAVAILABLE",
			);
		}

		if (response.status === 404) {
			throw new MarketDataProviderError(
				"This product is not available from the configured market-data provider.",
				"UNSUPPORTED_SYMBOL",
				404,
			);
		}
		if (response.status === 429) {
			throw new MarketDataProviderError(
				"The market-data provider rate limit was reached.",
				"RATE_LIMITED",
				429,
			);
		}
		if (!response.ok) {
			throw new MarketDataProviderError(
				"The market-data provider returned an error.",
				"UNAVAILABLE",
				response.status,
			);
		}

		try {
			return await response.json();
		} catch {
			throw new MarketDataProviderError(
				"The market-data provider returned invalid JSON.",
				"INVALID_RESPONSE",
				response.status,
			);
		}
	}
}

function normalizeProductId(symbol: string): string {
	const normalized = symbol.trim().toUpperCase();
	if (!/^[A-Z0-9]+-[A-Z0-9]+$/.test(normalized)) {
		throw new MarketDataProviderError(
			"Use a Coinbase product symbol such as BTC-USD.",
			"INVALID_SYMBOL",
		);
	}
	return normalized;
}

function parseTicker(payload: unknown): CoinbaseTicker {
	if (
		!isRecord(payload) ||
		typeof payload.price !== "string" ||
		typeof payload.time !== "string"
	) {
		throw new MarketDataProviderError(
			"The provider ticker response failed validation.",
			"INVALID_RESPONSE",
		);
	}
	parsePositiveNumber(payload.price);
	parseTimestamp(payload.time);
	return { price: payload.price, time: payload.time };
}

function parseCandles(
	payload: unknown,
	window?: { start: number; end: number },
): MarketCandle[] {
	if (!Array.isArray(payload)) {
		throw new MarketDataProviderError(
			"The provider candle response failed validation.",
			"INVALID_RESPONSE",
		);
	}
	const candles = payload.map((row): MarketCandle => {
		if (!Array.isArray(row) || row.length < 6) {
			throw new MarketDataProviderError(
				"The provider candle response failed validation.",
				"INVALID_RESPONSE",
			);
		}
		const [seconds, low, high, open, close, volume] = row;
		if (
			typeof seconds !== "number" ||
			!Number.isInteger(seconds) ||
			seconds <= 0
		) {
			throw new MarketDataProviderError(
				"The provider returned an invalid candle timestamp.",
				"INVALID_RESPONSE",
			);
		}
		const candle = {
			time: new Date(seconds * 1000).toISOString(),
			open: parsePositiveNumber(open),
			high: parsePositiveNumber(high),
			low: parsePositiveNumber(low),
			close: parsePositiveNumber(close),
			volume: parseNonnegativeNumber(volume),
		};
		if (
			candle.high < Math.max(candle.open, candle.close, candle.low) ||
			candle.low > Math.min(candle.open, candle.close)
		) {
			throw new MarketDataProviderError(
				"The provider returned inconsistent OHLC values.",
				"INVALID_RESPONSE",
			);
		}
		return candle;
	});

	const uniqueCandles = new Map(candles.map((candle) => [candle.time, candle]));
	return [...uniqueCandles.values()]
		.filter(
			(candle) =>
				!window ||
				(Date.parse(candle.time) >= window.start &&
					Date.parse(candle.time) < window.end),
		)
		.sort((left, right) => left.time.localeCompare(right.time))
		.slice(-MAX_CANDLES);
}

function parsePositiveNumber(value: unknown): number {
	const parsed =
		typeof value === "number"
			? value
			: typeof value === "string"
				? Number(value)
				: Number.NaN;
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new MarketDataProviderError(
			"The provider returned a non-positive or invalid price value.",
			"INVALID_RESPONSE",
		);
	}
	return parsed;
}

function parseNonnegativeNumber(value: unknown): number {
	const parsed =
		typeof value === "number"
			? value
			: typeof value === "string"
				? Number(value)
				: Number.NaN;
	if (!Number.isFinite(parsed) || parsed < 0) {
		throw new MarketDataProviderError(
			"The provider returned an invalid volume value.",
			"INVALID_RESPONSE",
		);
	}
	return parsed;
}

function parseTimestamp(value: string): string {
	const timestamp = new Date(value);
	if (!Number.isFinite(timestamp.getTime())) {
		throw new MarketDataProviderError(
			"The provider returned an invalid timestamp.",
			"INVALID_RESPONSE",
		);
	}
	return timestamp.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
