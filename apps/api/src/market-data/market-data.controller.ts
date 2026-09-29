import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { MarketDataQueryDto } from "./market-data.dto";
import { MarketDataService } from "./market-data.service";

@ApiTags("market-data")
@ApiCookieAuth("sessionCookie")
@Controller("market-data")
export class MarketDataController {
  constructor(private readonly service: MarketDataService) {}

  @Get(":symbol")
  @ApiOperation({ summary: "Get provider-backed market price, candles, indicators, and trend for a product." })
  async getMarketData(@Param("symbol") symbol: string, @Query() query: MarketDataQueryDto) {
    return { data: await this.service.getMarketData(symbol, query.interval) };
  }
}
