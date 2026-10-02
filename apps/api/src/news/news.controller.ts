import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import { ApiReadAuth, ApiStandardResponses } from "../common/api-documentation";
import { ApiScopes } from "../common/auth";
import { NewsService } from "./news.service";

class NewsQueryDto {
  @ApiPropertyOptional({ description: "Inclusive publication window start (ISO 8601)." })
  @IsOptional()
  @IsDateString()
  publishedFrom?: string;

  @ApiPropertyOptional({ description: "Inclusive publication window end (ISO 8601)." })
  @IsOptional()
  @IsDateString()
  publishedTo?: string;

  @ApiPropertyOptional({ description: "Catalog symbol or asset keyword; matches stored tags or article text." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  asset?: string;

  @ApiPropertyOptional({ description: "Stored source category." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ description: "Search article title, description or source." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}

@ApiTags("news")
@ApiReadAuth()
@ApiStandardResponses()
@Controller("news")
export class NewsController {
  constructor(private readonly service: NewsService) {}
  @ApiScopes("news:read")
  @Get()
  @ApiOperation({ summary: "List normalized RSS articles with source provenance." })
  list(@Query() query: NewsQueryDto) {
    return this.service.list(query);
  }
}
