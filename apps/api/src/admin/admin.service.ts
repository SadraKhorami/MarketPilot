import { Prisma } from "@marketpilot/db";
import { Injectable, NotFoundException } from "@nestjs/common";
import { aiConfiguration } from "../ai/ai.service";

import { AdminQueryDto, pageResult, sinceDays } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
import { RedisService } from "../redis.service";

const identitySelect = { id: true, name: true, email: true } as const;
const userSelect = {
  ...identitySelect,
  status: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { role: { select: { name: true } } } },
} as const;
const pageArgs = (query: AdminQueryDto) => ({ skip: (query.page - 1) * query.pageSize, take: query.pageSize });
const identitySearch = (search: string): Prisma.UserWhereInput => ({
  OR: [{ email: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }],
});

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}
  async overview(days: number) {
    const since = sinceDays(days);
    const where = { occurredAt: { gte: since } };
    const [users, activeUsers, admins, keys, sessions, requests, errors, latency, grouped, events, endpoints] =
      await Promise.all([
        this.db.user.count(),
        this.db.user.count({ where: { status: "ACTIVE" } }),
        this.db.user.count({ where: { roles: { some: { role: { name: "ADMIN" } } } } }),
        this.db.apiKey.count({
          where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        }),
        this.db.session.count({
          where: { revokedAt: null, expiresAt: { gt: new Date() }, user: { status: "ACTIVE" } },
        }),
        this.db.apiUsage.count({ where }),
        this.db.apiUsage.count({ where: { ...where, statusCode: { gte: 400 } } }),
        this.db.apiUsage.aggregate({ where, _avg: { latencyMs: true } }),
        this.db.$queryRaw<Array<{ day: Date; browser: bigint; keys: bigint }>>(
          Prisma.sql`SELECT date_trunc('day', "occurredAt", 'UTC') AS day, count(*) FILTER (WHERE "authType" = 'SESSION')::bigint AS browser, count(*) FILTER (WHERE "authType" = 'API_KEY')::bigint AS keys FROM "ApiUsage" WHERE "occurredAt" >= ${since} GROUP BY 1 ORDER BY 1`,
        ),
        this.db.activityLog.findMany({
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
          take: 5,
          select: { id: true, description: true, eventType: true, occurredAt: true, user: { select: identitySelect } },
        }),
        this.db.apiUsage.groupBy({
          by: ["route"],
          where,
          _count: { route: true },
          orderBy: { _count: { route: "desc" } },
          take: 5,
        }),
      ]);
    const counts = new Map(grouped.map((row) => [row.day.toISOString().slice(0, 10), row]));
    return {
      days,
      users,
      activeUsers,
      admins,
      activeKeys: keys,
      activeSessions: sessions,
      requests,
      errors,
      averageLatencyMs: latency._avg.latencyMs,
      traffic: Array.from({ length: days }, (_, i) => {
        const day = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
        const row = counts.get(day);
        return { day, browser: Number(row?.browser ?? 0), keys: Number(row?.keys ?? 0) };
      }),
      events,
      endpoints: endpoints.map((row) => ({ route: row.route, requests: row._count.route })),
    };
  }
  async users(query: AdminQueryDto) {
    const where: Prisma.UserWhereInput = {
      ...(query.search ? identitySearch(query.search.trim()) : {}),
      ...(query.status === "ACTIVE" || query.status === "DISABLED" ? { status: query.status } : {}),
      ...(query.role ? { roles: { some: { role: { name: query.role } } } } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.user.findMany({
        where,
        select: { ...userSelect, _count: { select: { apiKeys: true, watchlists: true, alerts: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...pageArgs(query),
      }),
      this.db.user.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async user(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      select: {
        ...userSelect,
        _count: { select: { watchlists: true, alerts: true, apiKeys: true, activity: true } },
        activity: {
          orderBy: { occurredAt: "desc" },
          take: 5,
          select: { id: true, description: true, occurredAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException("Account not found.");
    return user;
  }
  async requests(query: AdminQueryDto) {
    const where: Prisma.ApiUsageWhereInput = {
      occurredAt: { gte: sinceDays(query.days) },
      ...(query.authType ? { authType: query.authType } : {}),
      ...(query.outcome ? { statusCode: query.outcome === "error" ? { gte: 400 } : { lt: 400 } } : {}),
      ...(query.search
        ? {
            OR: [
              { route: { contains: query.search, mode: "insensitive" } },
              { requestId: { contains: query.search } },
              { user: identitySearch(query.search) },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.apiUsage.findMany({
        where,
        select: {
          id: true,
          requestId: true,
          route: true,
          method: true,
          authType: true,
          statusCode: true,
          latencyMs: true,
          occurredAt: true,
          user: { select: identitySelect },
          apiKey: { select: { name: true, prefix: true } },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        ...pageArgs(query),
      }),
      this.db.apiUsage.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async activity(query: AdminQueryDto) {
    const where: Prisma.ActivityLogWhereInput = {
      occurredAt: { gte: sinceDays(query.days) },
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: "insensitive" } },
              { eventType: { contains: query.search, mode: "insensitive" } },
              { user: identitySearch(query.search) },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.activityLog.findMany({
        where,
        select: {
          id: true,
          description: true,
          eventType: true,
          requestId: true,
          occurredAt: true,
          user: { select: identitySelect },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        ...pageArgs(query),
      }),
      this.db.activityLog.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async keys(query: AdminQueryDto) {
    const where: Prisma.ApiKeyWhereInput = {
      ...(query.status === "REVOKED"
        ? { revokedAt: { not: null } }
        : query.status === "ACTIVE"
          ? { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }
          : {}),
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: query.search, mode: "insensitive" } },
                  { prefix: { contains: query.search } },
                  { user: identitySearch(query.search) },
                ],
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.apiKey.findMany({
        where,
        select: {
          id: true,
          name: true,
          prefix: true,
          scopes: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
          expiresAt: true,
          user: { select: identitySelect },
          _count: { select: { usage: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...pageArgs(query),
      }),
      this.db.apiKey.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async system() {
    const check = async (operation: () => Promise<unknown>) => {
      const start = Date.now();
      try {
        await operation();
        return { status: "healthy", latencyMs: Date.now() - start };
      } catch {
        return { status: "unavailable", latencyMs: null };
      }
    };
    const [database, redis, articles] = await Promise.all([
      check(() => this.db.$queryRaw`SELECT 1`),
      check(async () => {
        await this.redis.ensureConnected();
        await this.redis.client.ping();
      }),
      this.db.newsArticle.count().catch(() => null),
    ]);
    return {
      checkedAt: new Date(),
      database,
      redis,
      articles,
      integrations: [
        {
          name: "Market data",
          status: "implemented",
          detail:
            "Coinbase Exchange prices and candles; Redis cache. Availability is checked when an asset is requested.",
        },
        {
          name: "News ingestion",
          status: process.env.NEWS_INGESTION_ENABLED === "true" ? "enabled" : "disabled",
          detail: "Scheduled RSS ingestion with original source links.",
        },
        {
          name: "In-app notifications",
          status: "implemented",
          detail:
            "Personal inbox, security/account notices and administrative announcements. Email delivery is not connected.",
        },
        {
          name: "AI analyst",
          status: aiConfiguration().configured ? "configured" : "unavailable",
          detail:
            "OpenRouter research with validated application tools and confirmed alert proposals. Model capability and live availability are checked per request.",
        },
        {
          name: "Alert delivery",
          status: "implemented",
          detail:
            "Price, RSI and candle change evaluation with durable inbox delivery. Inspect worker health and queues below.",
        },
        {
          name: "Telegram & Discord",
          status: "not implemented",
          detail: "Account linking and bot delivery are planned.",
        },
        { name: "Payments", status: "not implemented", detail: "No billing provider or transaction records exist." },
      ],
    };
  }
}
