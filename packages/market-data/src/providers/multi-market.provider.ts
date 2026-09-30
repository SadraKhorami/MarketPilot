import { referenceMarkets } from "../catalog";
import type { MarketDataInterval, MarketDataProvider } from "../types";
import { CoinbaseExchangeProvider } from "./coinbase-exchange.provider";
import { TradingViewProvider } from "./tradingview.provider";

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
	private resolve(symbol: string): MarketDataProvider {
		return referenceMarkets.some((market) => market.symbol === symbol)
			? this.multiAsset
			: this.crypto;
	}
}
