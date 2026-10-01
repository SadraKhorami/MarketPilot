import { createHash, randomBytes } from "node:crypto";
import { type BotProvider, botConfiguration, dashboardUrl, plainText } from "@marketpilot/bots";
import { Prisma } from "@marketpilot/db";
import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "../database.module";
import { BotRateService } from "./bot-rate.service";

@Injectable()
export class BotLinksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly rate: BotRateService,
  ) {}
  async state(userId: string, provider: BotProvider) {
    const [channel, candidate] = await Promise.all([
      this.db.notificationChannel.findUnique({
        where: { userId_provider: { userId, provider } },
        select: { active: true, displayName: true, externalAccountId: true, verifiedAt: true, preferences: true },
      }),
      this.db.botLinkToken.findFirst({
        where: {
          userId,
          provider,
          revokedAt: null,
          confirmedAt: null,
          consumedAt: { not: null },
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, candidateId: true, candidateName: true, expiresAt: true },
      }),
    ]);
    return {
      configuration: botConfiguration(provider),
      channel: channel
        ? {
            ...channel,
            active: Boolean(channel.active && channel.verifiedAt && channel.externalAccountId),
            preferences: {
              marketAlerts:
                channel.preferences !== null &&
                typeof channel.preferences === "object" &&
                !Array.isArray(channel.preferences) &&
                channel.preferences.marketAlerts === true,
            },
          }
        : null,
      candidate,
      installUrl:
        provider === "DISCORD" && botConfiguration(provider).configured
          ? `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_APPLICATION_ID}&scope=bot%20applications.commands&permissions=0`
          : null,
    };
  }
  async initiate(userId: string, provider: BotProvider) {
    if (!botConfiguration(provider).configured)
      throw new ServiceUnavailableException("Ask an administrator to configure this bot first.");
    await this.rate.consume("link-create", userId, 10, 3600);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60000);
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      const owner = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (owner?.status !== "ACTIVE") throw new BadRequestException("This account is unavailable.");
      const channel = await tx.notificationChannel.findUnique({ where: { userId_provider: { userId, provider } } });
      if (channel?.active && channel.verifiedAt && channel.externalAccountId)
        throw new ConflictException("Disconnect the existing account before linking another.");
      await tx.botLinkToken.updateMany({
        where: { userId, provider, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.botLinkToken.create({
        data: { userId, provider, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt },
      });
      await tx.activityLog.create({
        data: {
          userId,
          eventType: "BOT_LINK_STARTED",
          description: `Started ${provider} account linking`,
          metadata: { provider },
        },
      });
    });
    return {
      expiresAt,
      code: provider === "DISCORD" ? token : null,
      url: provider === "TELEGRAM" ? `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}` : null,
    };
  }
  async redeem(provider: BotProvider, token: string, identity: string, name: string) {
    await this.rate.consume("link-redeem", `${provider}:${identity}`, 5, 3600);
    const invalid = "This link is expired, already used or unavailable. Create a new link in MarketPilot.";
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return invalid;
    const hash = createHash("sha256").update(token).digest("hex");
    const reference = await this.db.botLinkToken.findUnique({ where: { tokenHash: hash }, select: { userId: true } });
    if (!reference) return invalid;
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${reference.userId}::uuid FOR UPDATE`;
      const owner = await tx.user.findUnique({ where: { id: reference.userId } });
      if (owner?.status !== "ACTIVE") return invalid;
      const existing = await tx.notificationChannel.findUnique({
        where: { provider_externalAccountId: { provider, externalAccountId: identity } },
      });
      if (existing && existing.userId !== owner.id) return invalid;
      const changed = await tx.botLinkToken.updateMany({
        where: { tokenHash: hash, provider, consumedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date(), candidateId: identity, candidateName: plainText(name).slice(0, 120) },
      });
      if (!changed.count) return invalid;
      return `✅ Account received\n\nNext step\nReturn to MarketPilot and confirm that the displayed account belongs to you:\n${dashboardUrl(`/dashboard/bots/${provider.toLowerCase()}`)}\n\nYour account is not linked until you confirm it. You can then enable market alert notifications.`;
    });
  }
  async confirm(userId: string, provider: BotProvider, id: string) {
    try {
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "BotLinkToken" WHERE id = ${id}::uuid FOR UPDATE`;
        const token = await tx.botLinkToken.findUnique({ where: { id } });
        const owner = await tx.user.findUnique({ where: { id: userId } });
        if (
          !token ||
          token.userId !== userId ||
          token.provider !== provider ||
          !token.consumedAt ||
          token.revokedAt ||
          token.confirmedAt ||
          token.expiresAt <= new Date() ||
          !token.candidateId ||
          owner?.status !== "ACTIVE"
        )
          throw new BadRequestException("This account link is no longer available.");
        const channel = await tx.notificationChannel.findUnique({ where: { userId_provider: { userId, provider } } });
        if (channel?.active && channel.verifiedAt && channel.externalAccountId)
          throw new ConflictException("Disconnect the existing account first.");
        await tx.notificationChannel.upsert({
          where: { userId_provider: { userId, provider } },
          create: {
            userId,
            provider,
            externalAccountId: token.candidateId,
            displayName: token.candidateName,
            verifiedAt: new Date(),
            active: true,
            preferences: { marketAlerts: false },
          },
          update: {
            externalAccountId: token.candidateId,
            displayName: token.candidateName,
            verifiedAt: new Date(),
            active: true,
            preferences: { marketAlerts: false },
          },
        });
        await tx.botLinkToken.updateMany({
          where: { userId, provider, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.botLinkToken.update({ where: { id }, data: { confirmedAt: new Date() } });
        await tx.activityLog.create({
          data: {
            userId,
            eventType: "BOT_LINK_CONFIRMED",
            description: `Linked verified ${provider} account`,
            metadata: { provider },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("This platform account is already linked. Disconnect its previous account first.");
      throw error;
    }
    return this.state(userId, provider);
  }
  async disconnect(userId: string, provider: BotProvider) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      await tx.notificationChannel.updateMany({
        where: { userId, provider },
        data: {
          active: false,
          externalAccountId: null,
          displayName: null,
          verifiedAt: null,
          preferences: { marketAlerts: false },
        },
      });
      await tx.botLinkToken.updateMany({
        where: { userId, provider, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.externalDelivery.updateMany({
        where: { userId, provider, status: { in: ["pending", "retry"] } },
        data: { status: "suppressed", failureCode: "ACCOUNT_DISCONNECTED" },
      });
      await tx.activityLog.create({
        data: {
          userId,
          eventType: "BOT_DISCONNECTED",
          description: `Disconnected ${provider} and revoked pending links`,
          metadata: { provider },
        },
      });
    });
    return this.state(userId, provider);
  }
  async preferences(userId: string, provider: BotProvider, marketAlerts: boolean) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      const updated = await tx.notificationChannel.updateMany({
        where: { userId, provider, active: true, verifiedAt: { not: null } },
        data: { preferences: { marketAlerts } },
      });
      if (!updated.count) throw new BadRequestException("Link an account first.");
      await tx.activityLog.create({
        data: {
          userId,
          eventType: "BOT_PREFERENCES_UPDATED",
          description: `Updated ${provider} market alert preference`,
          metadata: { provider, marketAlerts },
        },
      });
    });
    return this.state(userId, provider);
  }
}
