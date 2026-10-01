import { effectivePlan, type Prisma, plans } from "@marketpilot/db";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database.module";

@Injectable()
export class EntitlementsService {
  constructor(private readonly db: DatabaseService) {}

  async locked<T>(userId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(
      async (tx) => {
        await this.lock(tx, userId);
        return action(tx);
      },
      { timeout: 60000, maxWait: 10000 },
    );
  }

  async lock(tx: Prisma.TransactionClient, userId: string) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
  }

  async plan(userId: string, store: Prisma.TransactionClient = this.db) {
    return plans[effectivePlan(await store.subscription.findUnique({ where: { userId } }))];
  }

  async capacity(
    tx: Prisma.TransactionClient,
    userId: string,
    resource: "watchlists" | "activeAlerts" | "apiKeys" | "watchlistItems",
    watchlistId?: string,
  ) {
    await this.lock(tx, userId);
    const limits = await this.plan(userId, tx);
    const count =
      resource === "watchlists"
        ? await tx.watchlist.count({ where: { userId } })
        : resource === "activeAlerts"
          ? await tx.alert.count({ where: { userId, enabled: true } })
          : resource === "apiKeys"
            ? await tx.apiKey.count({
                where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
              })
            : await tx.watchlistItem.count({ where: { watchlistId, watchlist: { userId } } });
    if (count >= limits[resource]) this.exceeded(resource, limits[resource]);
  }

  async consume(userId: string, resource: "ai" | "api") {
    return this.locked(userId, (tx) => this.consumeIn(tx, userId, resource));
  }

  async consumeIn(tx: Prisma.TransactionClient, userId: string, resource: "ai" | "api") {
    await this.lock(tx, userId);
    const limits = await this.plan(userId, tx);
    const limit = resource === "ai" ? limits.aiDaily : limits.apiDaily;
    const day = new Date().toISOString().slice(0, 10);
    const where = { userId_day_resource: { userId, day, resource } };
    const usage = await tx.quotaUsage.findUnique({ where });
    if ((usage?.count ?? 0) >= limit) this.exceeded(`${resource} requests today`, limit, true);
    await tx.quotaUsage.upsert({
      where,
      create: { userId, day, resource, count: 1 },
      update: { count: { increment: 1 } },
    });
  }

  async external(tx: Prisma.TransactionClient, userId: string) {
    if (!(await this.plan(userId, tx)).externalAlerts)
      throw new ForbiddenException({
        error: {
          code: "PLAN_UPGRADE_REQUIRED",
          message: "Telegram and Discord alert delivery requires Pro. Manage your plan in Billing.",
        },
      });
  }

  private exceeded(resource: string, limit: number, daily = false): never {
    throw new ForbiddenException({
      error: {
        code: "PLAN_LIMIT_REACHED",
        message: `Your plan allows ${limit} ${resource}. Manage your plan in Billing.${daily ? " Daily usage resets at 00:00 UTC." : " Remove an unused resource before adding another."}`,
      },
    });
  }
}
