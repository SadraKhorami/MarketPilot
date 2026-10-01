import { BotProviderError, botConfiguration, botProviders, reserveSendSlot, sendAlert } from "@marketpilot/bots";
import type { ExternalDelivery, Prisma, PrismaClient } from "@marketpilot/db";
import { effectivePlan, plans } from "@marketpilot/db";
import type Redis from "ioredis";

const maximumAttempts = 5;
export async function deliverExternal(db: PrismaClient, redis: Redis, id: string) {
  const reference = await db.externalDelivery.findUnique({
    where: { id },
    include: { trigger: { select: { alertId: true } } },
  });
  if (!reference || !["pending", "retry", "sending"].includes(reference.status) || reference.nextAttemptAt > new Date())
    return;
  const provider = botProviders.find((item) => item === reference.provider);
  if (!provider) return;
  if (reference.status === "sending") {
    if (reference.sendingAt && reference.sendingAt.getTime() > Date.now() - 60000) return;
    if (provider === "TELEGRAM" || !reference.sendingAt || reference.sendingAt.getTime() < Date.now() - 120000) {
      await db.externalDelivery.updateMany({
        where: { id, status: "sending" },
        data: { status: "unknown", failureCode: "PROVIDER_ACCEPTANCE_UNKNOWN" },
      });
      return;
    }
  }
  // A Discord nonce only deduplicates recent messages. Never extend that window after ambiguity.
  if (reference.status === "retry" && reference.sendingAt && reference.sendingAt.getTime() < Date.now() - 120000) {
    await db.externalDelivery.updateMany({
      where: { id, status: "retry" },
      data: { status: "unknown", failureCode: "PROVIDER_ACCEPTANCE_UNKNOWN" },
    });
    return;
  }
  if (!botConfiguration(provider).configured) {
    await db.externalDelivery.updateMany({
      where: { id, status: { in: ["pending", "retry"] } },
      data: { nextAttemptAt: new Date(Date.now() + 60000), failureCode: "PROVIDER_NOT_CONFIGURED" },
    });
    return;
  }
  try {
    await reserveSendSlot(provider, reference.destination, (script, key) => redis.eval(script, 1, key));
  } catch (error) {
    if (!(error instanceof BotProviderError)) throw new Error("BOT_LIMITS_UNAVAILABLE");
    await db.externalDelivery.updateMany({
      where: { id, status: { in: ["pending", "retry"] } },
      data: { nextAttemptAt: new Date(Date.now() + (error.retryAfterMs ?? 2000)) },
    });
    return;
  }
  const claimed = await db.$transaction(async (tx) => {
    await lockDelivery(tx, reference);
    const item = await tx.externalDelivery.findUnique({ where: { id } });
    if (
      !item ||
      !["pending", "retry", "sending"].includes(item.status) ||
      item.nextAttemptAt > new Date() ||
      (item.status === "sending" && item.sendingAt && item.sendingAt.getTime() > Date.now() - 60000)
    )
      return null;
    if (item.attempts >= maximumAttempts) {
      await tx.externalDelivery.update({
        where: { id },
        data: {
          status: item.sendingAt ? "unknown" : "failed",
          failureCode: item.sendingAt ? "PROVIDER_ACCEPTANCE_UNKNOWN" : "DELIVERY_ATTEMPTS_EXHAUSTED",
        },
      });
      return null;
    }
    if (!(await eligible(tx, item))) {
      await tx.externalDelivery.update({
        where: { id },
        data: { status: "suppressed", failureCode: "DELIVERY_NOT_ELIGIBLE" },
      });
      return null;
    }
    await tx.externalDelivery.update({
      where: { id },
      data: { status: "sending", sendingAt: item.sendingAt ?? new Date(), attempts: { increment: 1 } },
    });
    return { previousUncertainty: item.sendingAt !== null };
  });
  if (!claimed) return;
  // The send intent commits BEFORE contacting the provider. Row locks serialize disconnect/disable
  // with the bounded network call; a process crash leaves a durable ambiguous intent for recovery.
  await db.$transaction(
    async (tx) => {
      await lockDelivery(tx, reference);
      const item = await tx.externalDelivery.findUnique({ where: { id }, include: { trigger: true } });
      if (item?.status !== "sending") return;
      if (!(await eligible(tx, item))) {
        await tx.externalDelivery.update({
          where: { id },
          data: { status: "suppressed", failureCode: "DELIVERY_NOT_ELIGIBLE" },
        });
        return;
      }
      try {
        const event = item.trigger;
        const metric = event.condition.startsWith("PRICE")
          ? "Price"
          : event.condition.startsWith("RSI")
            ? "RSI14"
            : "Candle change";
        const number = (value: { toString(): string }) =>
          Number(value.toString()).toLocaleString("en-US", { maximumFractionDigits: 8 });
        const message = `${event.assetId} alert\n${metric} ${event.condition.endsWith("ABOVE") ? ">" : "<"} ${number(event.threshold)} ${event.unit}\nObserved ${number(event.value)} ${event.unit} at ${event.observationAt.toISOString()}\n${event.interval} · ${event.priceKind === "quote" ? "Provider quote" : "Completed candle close"}\nSource: ${event.source} · ${event.providerSymbol}`;
        const receiptId = await sendAlert(provider, item.destination, message, item.id);
        await tx.externalDelivery.update({
          where: { id },
          data: { status: "delivered", deliveredAt: new Date(), receiptId, failureCode: null },
        });
        await tx.botRuntime.upsert({
          where: { provider },
          create: { provider, checkedAt: new Date(), successfulAt: new Date() },
          update: { checkedAt: new Date(), successfulAt: new Date(), failureCode: null },
        });
      } catch (error) {
        const safe = error instanceof BotProviderError ? error : new BotProviderError("PROVIDER_RESPONSE_INVALID");
        const terminal = [
          "DESTINATION_UNAVAILABLE",
          "PROVIDER_CREDENTIAL_INVALID",
          "PROVIDER_REQUEST_REJECTED",
          "PROVIDER_RESPONSE_INVALID",
        ].includes(safe.code);
        // A later definitive rejection cannot prove an earlier ambiguous attempt was not accepted.
        const uncertain = claimed.previousUncertainty || safe.uncertain;
        const ambiguous = uncertain && (provider === "TELEGRAM" || terminal || item.attempts >= maximumAttempts);
        const status = ambiguous ? "unknown" : terminal || item.attempts >= maximumAttempts ? "failed" : "retry";
        const delay = safe.retryAfterMs ?? Math.min(60000, 2000 * 2 ** (item.attempts - 1));
        await tx.externalDelivery.update({
          where: { id },
          data: {
            status,
            failureCode: safe.code,
            nextAttemptAt: new Date(Date.now() + delay),
            ...(uncertain ? {} : { sendingAt: null }),
          },
        });
        await tx.botRuntime.upsert({
          where: { provider },
          create: { provider, checkedAt: new Date(), failureCode: safe.code },
          update: { checkedAt: new Date(), failureCode: safe.code },
        });
      }
    },
    { timeout: 30000, maxWait: 10000 },
  );
}
async function lockDelivery(tx: Prisma.TransactionClient, item: ExternalDelivery & { trigger: { alertId: string } }) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${item.userId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Alert" WHERE id = ${item.trigger.alertId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "NotificationChannel" WHERE id = ${item.channelId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "ExternalDelivery" WHERE id = ${item.id}::uuid FOR UPDATE`;
}
async function eligible(tx: Prisma.TransactionClient, item: ExternalDelivery) {
  const subscription = await tx.subscription.findUnique({ where: { userId: item.userId } });
  if (!plans[effectivePlan(subscription)].externalAlerts) return false;
  const channel = await tx.notificationChannel.findUnique({
    where: { id: item.channelId },
    include: { user: { select: { status: true } } },
  });
  const event = await tx.alertTrigger.findUnique({ where: { id: item.triggerId }, include: { alert: true } });
  const preference = channel?.preferences;
  return (
    channel?.userId === item.userId &&
    channel.user.status === "ACTIVE" &&
    channel.active &&
    channel.provider === item.provider &&
    channel.externalAccountId === item.destination &&
    channel.verifiedAt?.getTime() === item.linkedAt.getTime() &&
    preference !== null &&
    typeof preference === "object" &&
    !Array.isArray(preference) &&
    preference.marketAlerts === true &&
    event?.userId === item.userId &&
    event.alert.userId === item.userId &&
    event.alert.enabled
  );
}
