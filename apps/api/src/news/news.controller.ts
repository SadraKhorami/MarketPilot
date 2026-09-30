import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { ApiScopes } from "../common/auth";
import { DatabaseService } from "../database.module";
import { RedisService } from "../redis.service";

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
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @ApiScopes("news:read")
  @Get()
  @ApiOperation({ summary: "List normalized RSS articles with source provenance." })
  async list(@Query() query: NewsQueryDto) {
    const search = query.search?.trim();
    const where = {
      ...(query.asset ? { affectedAssets: { has: query.asset.toUpperCase() } } : {}),
      ...(query.category ? { sourceCategories: { has: query.category } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
              { source: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [articles, total, refreshState] = await Promise.all([
      this.db.newsArticle.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.newsArticle.count({ where }),
      this.readRefreshState(),
    ]);
    return {
      data: {
        articles,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        refreshState,
        sentiment: null as null,
      },
    };
  }

  private async readRefreshState() {
    try {
      await this.redis.ensureConnected();
      const state = await this.redis.client.get("marketpilot:news:refresh-status:v1");
      return state ? JSON.parse(state) : { enabled: process.env.NEWS_INGESTION_ENABLED === "true", status: "pending" };
    } catch {
      return { enabled: process.env.NEWS_INGESTION_ENABLED === "true", status: "status_unavailable" };
    }
  }
}
