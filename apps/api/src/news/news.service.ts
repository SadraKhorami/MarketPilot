import { assetNewsPattern, assetSearchTerms } from "@marketpilot/market-data";
import { Prisma } from "@marketpilot/db";
import { MarketCatalogService } from "../market-data/market-catalog.service";
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database.module";
import { RedisService } from "../redis.service";
export interface NewsQueryDto {
  asset?: string;
  assets?: string[];
  categories?: string[];
  category?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  publishedFrom?: string;
  publishedTo?: string;
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
    const assets = [
      ...new Set(
        [...(query.assets ?? []), ...(asset ? [asset] : [])]
          .map((value) => value.trim().toUpperCase().replace("/", "-"))
          .filter(Boolean),
      ),
    ];
    if (assets.length) {
      const catalog = await this.catalog.list();
      const matchingIds = await Promise.all(
        assets.map(async (symbol) => {
          const instrument = catalog.instruments.find((item) => item.symbol === symbol || item.baseAsset === symbol);
          if (symbol === asset) terms = assetSearchTerms(symbol, instrument?.name);
          const pattern = assetNewsPattern(symbol, instrument?.name);
          const tags = [symbol, symbol.split("-")[0]];
          return this.db.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM "NewsArticle"
          WHERE "affectedAssets" && ARRAY[${Prisma.join(tags)}]::text[]
             OR title ~* ${pattern} OR description ~* ${pattern}
        `);
        }),
      );
      conditions.push({ id: { in: [...new Set(matchingIds.flat().map((row) => row.id))] } });
    }
    const categories = [...new Set([...(query.categories ?? []), ...(query.category ? [query.category] : [])])];
    if (categories.length) conditions.push({ sourceCategories: { hasSome: categories } });
    if (query.publishedFrom || query.publishedTo) {
      conditions.push({
        publishedAt: {
          ...(query.publishedFrom ? { gte: new Date(query.publishedFrom) } : {}),
          ...(query.publishedTo ? { lte: new Date(query.publishedTo) } : {}),
        },
      });
    }
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
    const [articles, total, refreshState, categoryGroups] = await Promise.all([
      this.db.newsArticle.findMany({
        where,
        orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { fetchedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.newsArticle.count({ where }),
      this.readRefreshState(),
      this.db.newsArticle.groupBy({
        by: ["sourceCategories"],
      }),
    ]);
    return {
      data: {
        articles,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        categories: [...new Set(categoryGroups.flatMap((article) => article.sourceCategories))]
          .filter((category) => category.trim())
          .sort((a, b) => a.localeCompare(b)),
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
