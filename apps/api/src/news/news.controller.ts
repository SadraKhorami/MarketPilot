import { Controller, Get, Query } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

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
}

@ApiTags("news")
@ApiCookieAuth("sessionCookie")
@Controller("news")
export class NewsController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List normalized RSS articles with source provenance." })
  async list(@Query() query: NewsQueryDto) {
    const where = {
      ...(query.asset ? { affectedAssets: { has: query.asset.toUpperCase() } } : {}),
      ...(query.category ? { sourceCategories: { has: query.category } } : {}),
    };
    const [articles, total, refreshState] = await Promise.all([
      this.db.newsArticle.findMany({ where, orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }], take: 100 }),
      this.db.newsArticle.count({ where }),
      this.readRefreshState(),
    ]);
    return { data: { articles, total, refreshState, sentiment: null as null } };
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
