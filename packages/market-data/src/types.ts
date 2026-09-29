import { z } from "zod";

export const marketDataIntervals = [
	"1m",
	"5m",
	"15m",
	"1h",
	"6h",
	"1d",
] as const;
export const MarketDataIntervalSchema = z.enum(marketDataIntervals);
export type MarketDataInterval = z.infer<typeof MarketDataIntervalSchema>;

export const MarketCandleSchema = z.object({
	time: z.string().datetime({ offset: true }),
	open: z.number().positive().finite(),
	high: z.number().positive().finite(),
	low: z.number().positive().finite(),
	close: z.number().positive().finite(),
	volume: z.number().nonnegative().finite(),
});
export type MarketCandle = z.infer<typeof MarketCandleSchema>;

export const TechnicalIndicatorsSchema = z.object({
	rsi: z.number().finite().nullable(),
	macd: z
		.object({
			value: z.number().finite(),
			signal: z.number().finite(),
			histogram: z.number().finite(),
		})
		.nullable(),
	sma50: z.number().finite().nullable(),
	sma200: z.number().finite().nullable(),
	bollingerBands: z
		.object({
			upper: z.number().finite(),
			middle: z.number().finite(),
			lower: z.number().finite(),
		})
		.nullable(),
	stochastic: z
		.object({ k: z.number().finite(), d: z.number().finite() })
		.nullable(),
	atr: z.number().finite().nullable(),
});
export type TechnicalIndicators = z.infer<typeof TechnicalIndicatorsSchema>;

export const MarketObservationSchema = z.object({
	symbol: z.string().min(1),
	providerSymbol: z.string().min(1),
	interval: MarketDataIntervalSchema,
	price: z.number().positive().finite(),
	timestamp: z.string().datetime({ offset: true }),
	candles: z.array(MarketCandleSchema).min(1).max(300),
	indicators: TechnicalIndicatorsSchema,
	trend: z.enum(["uptrend", "downtrend", "sideways"]).nullable(),
	supportResistance: z.object({
		support: z.array(z.number().positive()),
		resistance: z.array(z.number().positive()),
	}),
	marketStatus: z.object({ isOpen: z.boolean() }),
	volatility: z.object({
		atr: z.number().finite().nullable(),
		atrPercentage: z.number().finite().nullable(),
	}),
});
export type MarketObservation = z.infer<typeof MarketObservationSchema>;

export interface MarketDataProvider {
	readonly id: string;
	getMarketData(
		symbol: string,
		interval: MarketDataInterval,
	): Promise<MarketObservation>;
}

export type MarketDataErrorCode =
	| "INVALID_SYMBOL"
	| "UNSUPPORTED_SYMBOL"
	| "RATE_LIMITED"
	| "UNAVAILABLE"
	| "INVALID_RESPONSE";

export class MarketDataProviderError extends Error {
	constructor(
		message: string,
		readonly code: MarketDataErrorCode,
		readonly status?: number,
	) {
		super(message);
		this.name = "MarketDataProviderError";
	}
}
