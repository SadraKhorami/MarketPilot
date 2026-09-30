import { Client, type ChartSession } from "@mathieuc/tradingview";
import { z } from "zod";
import { referenceMarkets } from "../catalog";
import {
	calculateSupportResistance,
	calculateTechnicalIndicators,
	calculateTrend,
	calculateVolatility,
} from "../indicators";
import {
	MarketCandleSchema,
	MarketDataProviderError,
	MarketObservationSchema,
	type MarketDataInterval,
	type MarketDataProvider,
	type MarketObservation,
} from "../types";

const timeframes: Record<MarketDataInterval, string> = {
	"1m": "1",
	"5m": "5",
	"15m": "15",
	"1h": "60",
	"6h": "360",
	"1d": "D",
};
const periodsSchema = z
	.array(
		z.object({
			time: z.number().positive().finite(),
			open: z.number().positive().finite(),
			max: z.number().positive().finite(),
			min: z.number().positive().finite(),
			close: z.number().positive().finite(),
			volume: z.preprocess(
				(value) =>
					typeof value === "number" && !Number.isFinite(value) ? null : value,
				z.number().nonnegative().finite().nullish(),
			),
		}),
	)
	.min(1)
	.max(300);
const infosSchema = z.object({
	full_name: z.string().optional(),
	pro_name: z.string().optional(),
	currency_code: z.string().optional(),
	currency_id: z.string().optional(),
});

/** Server-only anonymous chart reads; every request closes its chart and WebSocket. */
export class TradingViewProvider implements MarketDataProvider {
	readonly id = "tradingview";
	private active = 0;
	private readonly pending = new Map<string, Promise<MarketObservation>>();

	getMarketData(
		symbol: string,
		interval: MarketDataInterval,
	): Promise<MarketObservation> {
		const market = referenceMarkets.find((item) => item.symbol === symbol);
		if (!market)
			return Promise.reject(
				new MarketDataProviderError(
					"This instrument is not in the TradingView catalog.",
					"UNSUPPORTED_SYMBOL",
				),
			);
		const key = `${symbol}:${interval}`;
		const existing = this.pending.get(key);
		if (existing) return existing;
		if (this.active >= 3)
			return Promise.reject(
				new MarketDataProviderError(
					"Market data requests are busy. Try again shortly.",
					"RATE_LIMITED",
				),
			);
		this.active++;
		const request = this.load(
			market.symbol,
			market.providerSymbol,
			market.quoteAsset,
			interval,
		).finally(() => {
			this.active--;
			this.pending.delete(key);
		});
		this.pending.set(key, request);
		return request;
	}

	private load(
		symbol: string,
		providerSymbol: string,
		quoteAsset: string,
		interval: MarketDataInterval,
	): Promise<MarketObservation> {
		return new Promise((resolve, reject) => {
			let client: Client | undefined;
			let chart: ChartSession | undefined;
			let settled = false;
			const finish = (
				observation?: MarketObservation,
				error?: MarketDataProviderError,
			) => {
				if (settled) return;
				settled = true;
				clearTimeout(timeout);
				try {
					chart?.delete();
				} catch {
					/* Socket may already be closed. */
				}
				void client?.end().catch(() => undefined);
				if (observation) resolve(observation);
				else
					reject(
						error ??
							new MarketDataProviderError(
								"TradingView data is temporarily unavailable.",
								"UNAVAILABLE",
							),
					);
			};
			const timeout = setTimeout(
				() =>
					finish(
						undefined,
						new MarketDataProviderError(
							"TradingView did not return market data in time. Try again.",
							"UNAVAILABLE",
						),
					),
				13_000,
			);
			try {
				client = new Client();
				// The library cannot close a connecting socket; close it if it opens after timeout.
				client.onConnected(() => {
					if (settled) void client?.end().catch(() => undefined);
				});
				client.onError(() => finish());
				client.onDisconnected(() => finish());
				chart = new client.Session.Chart();
				chart.onError(() =>
					finish(
						undefined,
						new MarketDataProviderError(
							"TradingView could not supply this market or interval.",
							"UNAVAILABLE",
						),
					),
				);
				chart.onUpdate((changes) => {
					if (settled || !changes.includes("$prices") || !chart) return;
					try {
						const info = infosSchema.parse(chart.infos);
						if (
							![info.full_name, info.pro_name].includes(providerSymbol) ||
							(info.currency_code ?? info.currency_id) !== quoteAsset
						) {
							throw new Error("Instrument or currency mismatch");
						}
						const candles = periodsSchema
							.parse(chart.periods)
							.map((bar) =>
								MarketCandleSchema.parse({
									time: new Date(bar.time * 1000).toISOString(),
									open: bar.open,
									high: bar.max,
									low: bar.min,
									close: bar.close,
									volume: bar.volume ?? null,
								}),
							)
							.sort((a, b) => a.time.localeCompare(b.time));
						if (
							candles.some(
								(bar) =>
									bar.high < Math.max(bar.open, bar.close, bar.low) ||
									bar.low > Math.min(bar.open, bar.close, bar.high),
							)
						)
							throw new Error("Invalid OHLC values");
						const latest = candles.at(-1);
						if (!latest) throw new Error("No candles");
						const indicators = calculateTechnicalIndicators(candles);
						finish(
							MarketObservationSchema.parse({
								symbol,
								providerSymbol,
								source: this.id,
								priceKind: "candle_close",
								interval,
								price: latest.close,
								timestamp: latest.time,
								candles,
								indicators,
								trend: calculateTrend(latest.close, indicators),
								supportResistance: calculateSupportResistance(candles),
								marketStatus: { isOpen: null },
								volatility: calculateVolatility(indicators, latest.close),
							}),
						);
					} catch {
						finish(
							undefined,
							new MarketDataProviderError(
								"TradingView returned market data that could not be validated.",
								"INVALID_RESPONSE",
							),
						);
					}
				});
				chart.setMarket(providerSymbol, {
					timeframe: timeframes[interval],
					range: 300,
					to: Math.floor(Date.now() / 1000),
				});
			} catch {
				finish();
			}
		});
	}
}
