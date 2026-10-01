import { type BotProvider, reserveSendSlot } from "@marketpilot/bots";
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database.module";
import { RedisService } from "../redis.service";
@Injectable()
export class BotRepliesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}
  async send(
    provider: BotProvider,
    identity: string,
    result: { ownerId: string | null; linkedAt: string | null },
    operation: () => Promise<unknown>,
  ) {
    await this.redis.ensureConnected();
    await reserveSendSlot(provider, identity, (script, key) => this.redis.client.eval(script, 1, key));
    if (!result.ownerId) {
      await operation();
      return true;
    }
    const userId = result.ownerId;
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "NotificationChannel" WHERE "userId" = ${userId}::uuid AND provider::text = ${provider} FOR UPDATE`;
        const channel = await tx.notificationChannel.findUnique({
          where: { userId_provider: { userId, provider } },
          include: { user: { select: { status: true } } },
        });
        if (
          !channel?.active ||
          channel.user.status !== "ACTIVE" ||
          channel.externalAccountId !== identity ||
          channel.verifiedAt?.toISOString() !== result.linkedAt
        )
          return false;
        await operation();
        return true;
      },
      { timeout: 20000, maxWait: 5000 },
    );
  }
}
