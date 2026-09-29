import { z } from "zod";

export const marketFeedIntervals = [
	"1",
	"5",
	"15",
	"30",
	"60",
	"240",
	"D",
	"W",
	"M",
] as const;
export const MarketFeedIntervalSchema = z.enum(marketFeedIntervals);
export type MarketFeedInterval = z.infer<typeof MarketFeedIntervalSchema>;

export const MarketFeedCandleSchema = z.object({
	time: z.string().datetime({ offset: true }),
	open: z.number().finite(),
	high: z.number().finite(),
	low: z.number().finite(),
	close: z.number().positive().finite(),
	volume: z.number().finite().nonnegative(),
});

const macdSchema = z.object({
	value: z.number().finite(),
	signal: z.number().finite(),
	histogram: z.number().finite(),
});
const bandsSchema = z.object({
	upper: z.number().finite(),
	middle: z.number().finite(),
	lower: z.number().finite(),
});
const stochasticSchema = z.object({
	k: z.number().finite(),
	d: z.number().finite(),
});

export const MarketFeedResponseSchema = z
	.object({
		symbol: z.string().min(1),
		interval: MarketFeedIntervalSchema,
		price: z.number().positive().finite(),
		timestamp: z.string().datetime({ offset: true }),
		candles: z.array(MarketFeedCandleSchema).min(1).max(120),
		indicators: z.object({
			rsi: z.number().finite(),
			macd: macdSchema,
			sma50: z.number().finite(),
			sma200: z.number().finite(),
			bollingerBands: bandsSchema,
			stochastic: stochasticSchema,
			atr: z.number().finite(),
		}),
		trend: z.enum(["uptrend", "downtrend", "sideways"]),
		supportResistance: z.object({
			support: z.array(z.number().finite()),
			resistance: z.array(z.number().finite()),
		}),
		marketStatus: z.object({ isOpen: z.boolean() }).passthrough(),
		volatility: z
			.object({ atr: z.number().finite(), atr_percentage: z.string() })
			.passthrough(),
		status: z.string().optional(),
		message: z.string().optional(),
		nextOpen: z.unknown().optional(),
	})
	.passthrough();

export type MarketFeedResponse = z.infer<typeof MarketFeedResponseSchema>;

export type MarketFeedErrorCode =
	| "CONFIGURATION"
	| "INVALID_REQUEST"
	| "UNAUTHORIZED"
	| "RATE_LIMITED"
	| "TIMEOUT"
	| "UNAVAILABLE"
	| "INVALID_RESPONSE";

export class MarketFeedError extends Error {
	constructor(
		message: string,
		readonly code: MarketFeedErrorCode,
		readonly status?: number,
	) {
		super(message);
		this.name = "MarketFeedError";
	}
}

export interface MarketFeedLogger {
	warn(
		message: string,
		context: Record<string, string | number | undefined>,
	): void;
}

export interface MarketFeedClientOptions {
	baseUrl?: string;
	token?: string;
	timeoutMs?: number;
	retries?: number;
	fetcher?: typeof fetch;
	logger?: MarketFeedLogger;
}

export class MarketFeedClient {
	private readonly fetcher: typeof fetch;
	private readonly logger: MarketFeedLogger;

	constructor(private readonly options: MarketFeedClientOptions) {
		this.fetcher = options.fetcher ?? fetch;
		this.logger = options.logger ?? {
			warn: (message, context) => console.warn(message, context),
		};
	}

	async getMarketData(
		symbol: string,
		interval: MarketFeedInterval,
	): Promise<MarketFeedResponse> {
		const normalizedSymbol = symbol.trim().toUpperCase();
		if (!/^[A-Z0-9_.:-]{1,80}$/.test(normalizedSymbol)) {
			throw new MarketFeedError("Market symbol is invalid.", "INVALID_REQUEST");
		}
		const parsedInterval = MarketFeedIntervalSchema.safeParse(interval);
		if (!parsedInterval.success)
			throw new MarketFeedError(
				"Market interval is unsupported.",
				"INVALID_REQUEST",
			);
		if (!this.options.baseUrl || !this.options.token) {
			throw new MarketFeedError(
				"MarketFeed is not configured.",
				"CONFIGURATION",
			);
		}

		let url: URL;
		try {
			url = new URL(
				`/api/market-data/${encodeURIComponent(normalizedSymbol)}`,
				this.options.baseUrl,
			);
		} catch {
			throw new MarketFeedError(
				"MarketFeed base URL is invalid.",
				"CONFIGURATION",
			);
		}
		url.searchParams.set("interval", interval);

		const retries = Math.max(0, Math.min(this.options.retries ?? 1, 1));
		for (let attempt = 0; attempt <= retries; attempt++) {
			let response: Response;
			try {
				response = await this.fetcher(url, {
					headers: {
						Authorization: `Bearer ${this.options.token}`,
						Accept: "application/json",
					},
					signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
					cache: "no-store",
				});
			} catch (error) {
				const timedOut =
					error instanceof DOMException && error.name === "TimeoutError";
				const code = timedOut ? "TIMEOUT" : "UNAVAILABLE";
				this.logFailure(normalizedSymbol, interval, code, attempt);
				if (attempt < retries) {
					await delay(200 * (attempt + 1));
					continue;
				}
				throw new MarketFeedError(
					timedOut
						? "MarketFeed request timed out."
						: "MarketFeed is unavailable.",
					code,
				);
			}

			if (response.ok) {
				const body: unknown = await response.json().catch(() => null);
				const parsed = MarketFeedResponseSchema.safeParse(body);
				if (!parsed.success) {
					this.logFailure(
						normalizedSymbol,
						interval,
						"INVALID_RESPONSE",
						attempt,
					);
					throw new MarketFeedError(
						"MarketFeed returned an invalid response.",
						"INVALID_RESPONSE",
						response.status,
					);
				}
				return parsed.data;
			}

			if (response.status === 401 || response.status === 403) {
				throw new MarketFeedError(
					"MarketFeed rejected its configured credentials.",
					"UNAUTHORIZED",
					response.status,
				);
			}
			if (response.status === 429) {
				this.logFailure(normalizedSymbol, interval, "RATE_LIMITED", attempt);
				throw new MarketFeedError(
					"MarketFeed rate limit was reached.",
					"RATE_LIMITED",
					response.status,
				);
			}
			if (response.status >= 500 && attempt < retries) {
				this.logFailure(normalizedSymbol, interval, "UNAVAILABLE", attempt);
				await delay(200 * (attempt + 1));
				continue;
			}
			const code = response.status >= 500 ? "UNAVAILABLE" : "INVALID_REQUEST";
			this.logFailure(normalizedSymbol, interval, code, attempt);
			throw new MarketFeedError(
				response.status >= 500
					? "MarketFeed could not provide this market data."
					: "MarketFeed rejected the request.",
				code,
				response.status,
			);
		}

		throw new MarketFeedError("MarketFeed is unavailable.", "UNAVAILABLE");
	}

	private logFailure(
		symbol: string,
		interval: string,
		code: string,
		attempt: number,
	) {
		this.logger.warn("MarketFeed request failed", {
			symbol,
			interval,
			code,
			attempt,
		});
	}
}

function delay(milliseconds: number) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
