import { Prisma } from "@marketpilot/db";
import { Injectable, NotFoundException } from "@nestjs/common";

import { sinceDays, UsageQueryDto } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
import { API_CATALOG } from "./api-catalog";

@Injectable()
export class ApiUsageService {
  constructor(private readonly db: DatabaseService) {}
  async summary(userId: string, query: UsageQueryDto) {
    if (
      query.keyId &&
      !(await this.db.apiKey.findFirst({ where: { id: query.keyId, userId }, select: { id: true } }))
    ) {
      throw new NotFoundException("API key not found.");
    }
    const since = sinceDays(query.days);
    const where: Prisma.ApiUsageWhereInput = {
      userId,
      authType: "API_KEY",
      occurredAt: { gte: since },
      ...(query.keyId ? { apiKeyId: query.keyId } : {}),
    };
    const [totalRequests, successfulRequests, latency, byDay, recent, keyCount] = await Promise.all([
      this.db.apiUsage.count({ where }),
      this.db.apiUsage.count({ where: { ...where, statusCode: { lt: 400 } } }),
      this.db.apiUsage.aggregate({ where, _avg: { latencyMs: true } }),
      this.db.$queryRaw<Array<{ day: Date; requests: bigint }>>(
        Prisma.sql`SELECT date_trunc('day', "occurredAt", 'UTC') AS day, count(*)::bigint AS requests FROM "ApiUsage" WHERE "userId" = ${userId}::uuid AND "authType" = 'API_KEY' AND "occurredAt" >= ${since} ${query.keyId ? Prisma.sql`AND "apiKeyId" = ${query.keyId}::uuid` : Prisma.empty} GROUP BY 1 ORDER BY 1`,
      ),
      this.db.apiUsage.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 10,
        select: {
          id: true,
          requestId: true,
          route: true,
          method: true,
          statusCode: true,
          latencyMs: true,
          occurredAt: true,
          apiKey: { select: { name: true, prefix: true } },
        },
      }),
      this.db.apiKey.count({ where: { userId } }),
    ]);
    const counts = new Map(byDay.map((item) => [item.day.toISOString().slice(0, 10), Number(item.requests)]));
    return {
      days: query.days,
      keyCount,
      totalRequests,
      successfulRequests,
      errorRequests: totalRequests - successfulRequests,
      averageLatencyMs: latency._avg.latencyMs,
      rateLimit: API_CATALOG.rateLimit,
      byDay: Array.from({ length: query.days }, (_, i) => {
        const day = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
        return { day, requests: counts.get(day) ?? 0 };
      }),
      recent,
    };
  }
}
