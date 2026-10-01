import { PrismaClient } from "@marketpilot/db";
import { InvestingRssSource, parseInvestingRssFeeds } from "@marketpilot/news";
import Redis from "ioredis";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
redis.on("error", () => console.error(JSON.stringify({ event: "news_redis_unavailable" })));
const intervalSeconds = Number(process.env.NEWS_REFRESH_INTERVAL_SECONDS ?? 900);
const lockKey = "marketpilot:news:refresh-lock:v1";
const statusKey = "marketpilot:news:refresh-status:v1";
const lockValue = `${process.pid}:${Date.now()}`;

async function refreshNews() {
  const startedAt = new Date().toISOString();
  if (process.env.NEWS_INGESTION_ENABLED !== "true") {
    await redis.set(
      statusKey,
      JSON.stringify({
        enabled: false,
        status: "disabled",
        checkedAt: startedAt,
      }),
      "EX",
      86_400,
    );
    return;
  }
  const feeds = parseInvestingRssFeeds(process.env.INVESTING_RSS_FEEDS_JSON);
  if (!feeds.length) {
    await redis.set(
      statusKey,
      JSON.stringify({
        enabled: true,
        status: "no_feeds_configured",
        checkedAt: startedAt,
      }),
      "EX",
      86_400,
    );
    return;
  }
  const acquired = await redis.set(lockKey, lockValue, "EX", 120, "NX");
  if (!acquired) return;

  try {
    const knownAssets = await prisma.watchlistItem.findMany({
      distinct: ["assetId"],
      select: { assetId: true },
    });
    const source = new InvestingRssSource({
      feeds,
      stateStore: redisFeedStateStore,
    });
    const results = await source.fetchFeeds(knownAssets.map(({ assetId }) => assetId));
    let stored = 0;
    for (const result of results) {
      for (const article of result.articles) {
        const existing = await prisma.newsArticle.findUnique({
          where: { canonicalUrlHash: article.canonicalUrlHash },
          select: { sourceCategories: true, affectedAssets: true },
        });
        await prisma.newsArticle.upsert({
          where: { canonicalUrlHash: article.canonicalUrlHash },
          create: article,
          update: {
            title: article.title,
            description: article.description,
            originalUrl: article.originalUrl,
            publishedAt: article.publishedAt,
            fetchedAt: article.fetchedAt,
            language: article.language,
            sourceCategories: [...new Set([...(existing?.sourceCategories ?? []), ...article.sourceCategories])],
            affectedAssets: [...new Set([...(existing?.affectedAssets ?? []), ...article.affectedAssets])],
          },
        });
        stored += 1;
      }
    }
    await redis.set(
      statusKey,
      JSON.stringify({
        enabled: true,
        status: results.some((result) => result.status === "updated" || result.status === "not_modified")
          ? "ok"
          : "failed",
        checkedAt: new Date().toISOString(),
        feeds: results.map(({ feedKey, category, status, errorCode, articles }) => ({
          feedKey,
          category,
          status,
          errorCode,
          articles: articles.length,
        })),
        stored,
        intervalSeconds,
      }),
      "EX",
      Math.max(intervalSeconds * 4, 3600),
    );
  } finally {
    await redis.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      lockKey,
      lockValue,
    );
  }
}

const redisFeedStateStore = {
  async get(feedKey: string) {
    const value = await redis.get(`marketpilot:news:feed-state:v1:${feedKey}`);
    return value ? (JSON.parse(value) as { etag?: string; lastModified?: string }) : null;
  },
  async set(feedKey: string, state: { etag?: string; lastModified?: string }) {
    await redis.set(`marketpilot:news:feed-state:v1:${feedKey}`, JSON.stringify(state), "EX", 604_800);
  },
};

export async function startNewsWorker() {
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 300)
    throw new Error("Invalid NEWS_REFRESH_INTERVAL_SECONDS");
  try {
    await redis.connect();
  } catch (error) {
    redis.disconnect();
    await prisma.$disconnect();
    throw error;
  }
  let active = refreshNews().catch(() => console.error(JSON.stringify({ event: "news_refresh_failed" })));
  const timer = setInterval(() => {
    active = active
      .then(() => refreshNews())
      .catch(() => console.error(JSON.stringify({ event: "news_refresh_failed" })));
  }, intervalSeconds * 1000);
  return async () => {
    clearInterval(timer);
    await active;
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  };
}
