import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { ApiScopes } from "../common/auth";
import { MarketDataQueryDto } from "./market-data.dto";
import { MarketDataService } from "./market-data.service";

@ApiTags("market-data")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("market-data")
export class MarketDataController {
  constructor(private readonly service: MarketDataService) {}

  @ApiScopes("market:read")
  @Get(":symbol")
  @ApiOperation({ summary: "Get provider-backed market price, candles, indicators, and trend for a product." })
  async getMarketData(@Param("symbol") symbol: string, @Query() query: MarketDataQueryDto) {
    return { data: await this.service.getMarketData(symbol, query.interval) };
  }
}
