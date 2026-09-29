import { Module } from "@nestjs/common";
import { CoinbaseExchangeProvider } from "@marketpilot/market-data";

import { MarketDataController } from "./market-data.controller";
import { MARKET_DATA_PROVIDER, MarketDataService } from "./market-data.service";

@Module({
  controllers: [MarketDataController],
  providers: [
    { provide: CoinbaseExchangeProvider, useFactory: () => new CoinbaseExchangeProvider() },
    { provide: MARKET_DATA_PROVIDER, useExisting: CoinbaseExchangeProvider },
    MarketDataService,
  ],
  exports: [MarketDataService],
})
export class MarketDataModule {}
