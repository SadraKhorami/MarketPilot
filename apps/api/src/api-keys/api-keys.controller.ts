import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser } from "../common/auth";
import { DatabaseService } from "../database.module";
import { CreateApiKeyDto } from "./api-keys.dto";
import { ApiKeysService } from "./api-keys.service";

@ApiTags("API keys")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("api-keys")
export class ApiKeysController {
  constructor(
    private readonly service: ApiKeysService,
    private readonly db: DatabaseService,
  ) {}
  @Get() async list(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.list(user.id) };
  }
  @Get("usage") async usage(@CurrentUser() user: AuthenticatedUser, @Query("days") days?: string) {
    const rangeDays = Math.min(90, Math.max(1, Number(days) || 30));
    const since = new Date(Date.now() - rangeDays * 86400000);
    const [totalRequests, successfulRequests, latency, byDay, recent] = await Promise.all([
      this.db.apiUsage.count({ where: { userId: user.id, occurredAt: { gte: since } } }),
      this.db.apiUsage.count({ where: { userId: user.id, occurredAt: { gte: since }, statusCode: { lt: 400 } } }),
      this.db.apiUsage.aggregate({ where: { userId: user.id, occurredAt: { gte: since } }, _avg: { latencyMs: true } }),
      this.db.$queryRaw<
        Array<{ day: Date; requests: bigint }>
      >`SELECT date_trunc('day', "occurredAt") AS day, count(*)::bigint AS requests FROM "ApiUsage" WHERE "userId" = ${user.id}::uuid AND "occurredAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      this.db.apiUsage.findMany({
        where: { userId: user.id },
        orderBy: { occurredAt: "desc" },
        take: 10,
        select: { requestId: true, route: true, method: true, statusCode: true, latencyMs: true, occurredAt: true },
      }),
    ]);
    return {
      data: {
        days: rangeDays,
        totalRequests,
        successfulRequests,
        errorRequests: totalRequests - successfulRequests,
        averageLatencyMs: latency._avg.latencyMs,
        byDay: byDay.map((item) => ({ day: item.day, requests: Number(item.requests) })),
        recent,
      },
    };
  }
  @Post()
  @ApiOperation({ summary: "Create a key. The secret is returned once and is never stored in plaintext." })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateApiKeyDto) {
    return { data: await this.service.create(user.id, body.name, body.scopes) };
  }
  @Delete(":id") async revoke(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { data: await this.service.revoke(user.id, id) };
  }
}
