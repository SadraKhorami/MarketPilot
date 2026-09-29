import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateWatchlistDto {
  @ApiProperty({ example: "Long-term ideas" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class AddWatchlistItemDto {
  @ApiProperty({ example: "BTC-USD" })
  @IsString()
  @Matches(/^[a-zA-Z0-9:_-]{2,32}$/)
  assetId!: string;
}

export class ReorderWatchlistDto {
  @ApiProperty({ type: [String], example: ["BTC-USD", "ETH-USD"] })
  @IsArray()
  @IsString({ each: true })
  assetIds!: string[];
}

export class UpdateWatchlistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}
