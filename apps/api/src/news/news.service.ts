import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database.module";
import { RedisService } from "../redis.service";
export interface NewsQueryDto {
  asset?: string;
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
@Injectable()
export class NewsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}
  async list(query: NewsQueryDto) {
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
