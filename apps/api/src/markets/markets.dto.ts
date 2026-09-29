import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsString, Matches } from "class-validator";
import { marketFeedIntervals } from "@marketpilot/marketfeed";

export class MarketDataQueryDto {
  @ApiProperty({ enum: marketFeedIntervals, required: false, default: "15" })
  @IsIn(marketFeedIntervals)
  interval: (typeof marketFeedIntervals)[number] = "15";
}

export class MarketSymbolDto {
  @ApiProperty({ example: "BTCUSDT", description: "Provider-supported MarketFeed symbol." })
  @IsString()
  @Matches(/^[A-Za-z0-9_.:-]{1,80}$/)
  symbol!: string;
}
