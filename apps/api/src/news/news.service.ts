import { assetSearchTerms } from "@marketpilot/market-data";
import type { Prisma } from "@marketpilot/db";
import { MarketCatalogService } from "../market-data/market-catalog.service";
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
    private readonly catalog: MarketCatalogService,
  ) {}
  async list(query: NewsQueryDto) {
    const search = query.search?.trim();
    const conditions: Prisma.NewsArticleWhereInput[] = [];
    const asset = query.asset?.trim().toUpperCase().replace("/", "-");
    let terms: string[] = [];
    if (asset) {
      const catalog = await this.catalog.list();
      const instrument = catalog.instruments.find((item) => item.symbol === asset || item.baseAsset === asset);
      terms = assetSearchTerms(asset, instrument?.name);
      const base = asset.split("-")[0];
      conditions.push({
        OR: [
          { affectedAssets: { hasSome: [asset, base] } },
          ...terms.flatMap((term) => [
            { title: { contains: term, mode: "insensitive" as const } },
            { description: { contains: term, mode: "insensitive" as const } },
          ]),
        ],
      });
    }
    if (query.category) conditions.push({ sourceCategories: { has: query.category } });
    if (search)
      conditions.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { source: { contains: search, mode: "insensitive" } },
        ],
      });
    const where: Prisma.NewsArticleWhereInput = { AND: conditions };
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
        assetFilter: asset ? { symbol: asset, terms, match: "tags_or_text" } : null,
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
