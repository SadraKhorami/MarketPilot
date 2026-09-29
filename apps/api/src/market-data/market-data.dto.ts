import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, Matches } from "class-validator";
import { marketDataIntervals } from "@marketpilot/market-data";

export class MarketDataQueryDto {
  @ApiProperty({ enum: marketDataIntervals, required: false, default: "15m" })
  @IsIn(marketDataIntervals)
  interval: (typeof marketDataIntervals)[number] = "15m";
}

export class MarketSymbolDto {
  @ApiProperty({ example: "BTC-USD", description: "A Coinbase Exchange spot product identifier." })
  @IsString()
  @Matches(/^[A-Za-z0-9]+-[A-Za-z0-9]+$/)
  symbol!: string;
}
