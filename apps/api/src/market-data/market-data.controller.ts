import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { ApiScopes } from "../common/auth";
import { MarketCatalogService } from "./market-catalog.service";
import { MarketDataQueryDto } from "./market-data.dto";
import { MarketDataService } from "./market-data.service";

@ApiTags("market-data")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("market-data")
export class MarketDataController {
  constructor(
    private readonly service: MarketDataService,
    private readonly catalog: MarketCatalogService,
  ) {}

  @ApiScopes("market:read")
  @Get("catalog")
  @ApiOperation({ summary: "Discover active instruments and their data source availability." })
  async listMarkets() {
    return { data: await this.catalog.list() };
  }

  @ApiScopes("market:read")
  @Get(":symbol")
  @ApiOperation({ summary: "Get provider-backed market price, candles, indicators, and trend for a product." })
  async getMarketData(@Param("symbol") symbol: string, @Query() query: MarketDataQueryDto) {
    return { data: await this.service.getMarketData(symbol, query.interval) };
  }
}
