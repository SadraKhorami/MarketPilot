import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { MarketDataQueryDto } from "./markets.dto";
import { MarketsService } from "./markets.service";

@ApiTags("market-data")
@ApiCookieAuth("sessionCookie")
@Controller("market-data")
export class MarketsController {
  constructor(private readonly service: MarketsService) {}

  @Get(":symbol")
  @ApiOperation({ summary: "Get MarketFeed price, candles, indicators and trend for a symbol." })
  async getMarketData(@Param("symbol") symbol: string, @Query() query: MarketDataQueryDto) {
    return { data: await this.service.getMarketData(symbol, query.interval) };
  }
}
