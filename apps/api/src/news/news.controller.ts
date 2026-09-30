import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { ApiScopes } from "../common/auth";
import { NewsService } from "./news.service";

class NewsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  asset?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}

@ApiTags("news")
@ApiSessionAuth()
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
