import { referenceMarkets } from "../catalog";
import {
	type MarketDataInterval,
	type MarketDataProvider,
	MarketDataProviderError,
} from "../types";
import type { CoinbaseExchangeProvider } from "./coinbase-exchange.provider";
import type { TradingViewProvider } from "./tradingview.provider";

export class MultiMarketProvider implements MarketDataProvider {
	readonly id = "multi-market";
	constructor(
		private readonly crypto: CoinbaseExchangeProvider,
		private readonly multiAsset: TradingViewProvider,
	) {}
	sourceFor(symbol: string) {
		return this.resolve(symbol).id;
	}
	getMarketData(symbol: string, interval: MarketDataInterval) {
		return this.resolve(symbol).getMarketData(symbol, interval);
	}
	async getCandles(
		symbol: string,
		interval: MarketDataInterval,
		start: number,
		end: number,
	) {
		const provider = this.resolve(symbol);
		if (!provider.getCandles)
			throw new MarketDataProviderError(
				"Historical candle retrieval is unavailable for this source.",
				"UNAVAILABLE",
			);
		return provider.getCandles(symbol, interval, start, end);
	}
	private resolve(symbol: string): MarketDataProvider {
		return referenceMarkets.some((market) => market.symbol === symbol)
			? this.multiAsset
			: this.crypto;
	}
}
