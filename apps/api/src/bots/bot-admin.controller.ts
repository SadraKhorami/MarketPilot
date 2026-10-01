import { BotProviderError, botConfiguration, botProviders, discordRequest, telegramRequest } from "@marketpilot/bots";
import { botHeartbeatKey, heartbeatKey } from "@marketpilot/jobs";
import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AiSessionGuard } from "../ai/ai-session.guard";
import { type AuthenticatedUser, CurrentUser, Roles } from "../common/auth";
import { PageQueryDto, pageResult } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
import { RedisService } from "../redis.service";
import { BotRateService } from "./bot-rate.service";
import { parseProvider } from "./bots.controller";
@Roles("ADMIN")
@UseGuards(AiSessionGuard)
@Controller("admin/bots")
export class BotAdminController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly rate: BotRateService,
  ) {}
  @Get() async overview() {
    let workers: { commands: number; alerts: number } | null = null;
    try {
      await this.redis.ensureConnected();
      const [commands, alerts] = await Promise.all([
        this.redis.client.zcount(botHeartbeatKey, Date.now() - 45000, "+inf"),
        this.redis.client.zcount(heartbeatKey, Date.now() - 45000, "+inf"),
      ]);
      workers = { commands, alerts };
    } catch {
      workers = null;
    }
    const runtimes = await this.db.botRuntime.findMany();
    return {
      data: {
        checkedAt: new Date(),
        workers,
        providers: botProviders.map((provider) => ({
          ...botConfiguration(provider),
          runtime: runtimes.find((row) => row.provider === provider) ?? null,
        })),
      },
    };
  }
  @Post(":provider/check") async check(@CurrentUser() user: AuthenticatedUser, @Param("provider") input: string) {
    const provider = parseProvider(input);
    await this.rate.consume("admin-check", user.id, 10, 3600);
    if (!botConfiguration(provider).configured)
      throw new BadRequestException("Configure the provider before checking connectivity.");
    let failureCode: string | null = null;
    try {
      if (provider === "TELEGRAM") {
        const identity = z
          .object({ is_bot: z.literal(true), username: z.string() })
          .parse(await telegramRequest("getMe", {}, false));
        if (identity.username.toLowerCase() !== process.env.TELEGRAM_BOT_USERNAME?.toLowerCase())
          throw new BotProviderError("PROVIDER_IDENTITY_MISMATCH");
      } else {
        const identity = z
          .object({ id: z.string() })
          .parse(await discordRequest("applications/@me", "GET", undefined, true, false));
        if (identity.id !== process.env.DISCORD_APPLICATION_ID)
          throw new BotProviderError("PROVIDER_IDENTITY_MISMATCH");
      }
    } catch (error) {
      failureCode = error instanceof BotProviderError ? error.code : "PROVIDER_RESPONSE_INVALID";
    }
    const checkedAt = new Date();
    await this.db.$transaction([
      this.db.botRuntime.upsert({
        where: { provider },
        create: { provider, checkedAt, failureCode, successfulAt: failureCode ? null : checkedAt },
        update: { checkedAt, failureCode, ...(failureCode ? {} : { successfulAt: checkedAt }) },
      }),
      this.db.activityLog.create({
        data: {
          userId: user.id,
          eventType: "BOT_CONNECTIVITY_CHECKED",
          description: `Checked ${provider} credentials and identity`,
          metadata: { provider, failureCode },
        },
      }),
    ]);
    return { data: { provider, checkedAt, failureCode } };
  }
  @Get("deliveries") async deliveries(@Query() query: PageQueryDto) {
    const [items, total] = await Promise.all([
      this.db.externalDelivery.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
        select: {
          id: true,
          provider: true,
          status: true,
          attempts: true,
          adminRetries: true,
          failureCode: true,
          createdAt: true,
          deliveredAt: true,
          nextAttemptAt: true,
          trigger: { select: { assetId: true } },
        },
      }),
      this.db.externalDelivery.count(),
    ]);
    return { data: pageResult(items, total, query) };
  }
  @Post("deliveries/:id/retry") async retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.rate.consume("admin-retry", user.id, 10, 3600);
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ExternalDelivery" WHERE id = ${id}::uuid FOR UPDATE`;
      const row = await tx.externalDelivery.findUnique({ where: { id } });
      if (row?.status !== "failed" || row.sendingAt || row.adminRetries >= 3)
        throw new BadRequestException(
          "Only a definitively failed delivery can be retried, up to three times. Unknown acceptance needs manual review.",
        );
      await tx.externalDelivery.update({
        where: { id },
        data: {
          status: "retry",
          attempts: 0,
          adminRetries: { increment: 1 },
          failureCode: null,
          nextAttemptAt: new Date(),
        },
      });
      await tx.activityLog.create({
        data: {
          userId: user.id,
          eventType: "BOT_DELIVERY_RETRIED",
          description: "Requested recovery of a definitively failed bot delivery",
          metadata: { provider: row.provider, deliveryId: id },
        },
      });
    });
    return { data: { success: true } };
  }
}
