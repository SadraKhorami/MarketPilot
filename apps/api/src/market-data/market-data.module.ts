import { Module } from "@nestjs/common";
import { CoinbaseExchangeProvider } from "@marketpilot/market-data";
import { MultiMarketProvider, TradingViewProvider } from "@marketpilot/market-data/providers";

import { MarketCatalogService } from "./market-catalog.service";
import { MarketDataController } from "./market-data.controller";
import { MARKET_DATA_PROVIDER, MarketDataService } from "./market-data.service";

@Module({
  controllers: [MarketDataController],
  providers: [
    { provide: CoinbaseExchangeProvider, useFactory: () => new CoinbaseExchangeProvider() },
    {
      provide: MARKET_DATA_PROVIDER,
      inject: [CoinbaseExchangeProvider],
      useFactory: (crypto: CoinbaseExchangeProvider) => new MultiMarketProvider(crypto, new TradingViewProvider()),
    },
    MarketDataService,
    MarketCatalogService,
  ],
  exports: [MarketDataService, MarketCatalogService],
})
export class MarketDataModule {}
