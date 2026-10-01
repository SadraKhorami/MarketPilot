import type { PrismaClient } from "@marketpilot/db";

export async function deliverTrigger(db: PrismaClient, triggerId: string) {
  const reference = await db.alertTrigger.findUnique({
    where: { id: triggerId },
    select: { alertId: true },
  });
  if (!reference) return;
  const delivered = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Alert" WHERE id = ${reference.alertId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "AlertTrigger" WHERE id = ${triggerId}::uuid FOR UPDATE`;
    const event = await tx.alertTrigger.findUnique({
      where: { id: triggerId },
      include: { alert: { include: { user: { select: { status: true } } } } },
    });
    if (event?.deliveryStatus !== "pending") return;
    const channel = await tx.notificationChannel.findUnique({
      where: { userId_provider: { userId: event.userId, provider: "WEB" } },
    });
    const preferences = channel?.preferences;
    const optedOut =
      preferences !== null &&
      typeof preferences === "object" &&
      !Array.isArray(preferences) &&
      preferences.inAppEnabled === false;
    if (
      event.alert.userId !== event.userId ||
      !event.alert.enabled ||
      event.alert.user.status !== "ACTIVE" ||
      (channel && !channel.active) ||
      optedOut
    ) {
      await tx.alertTrigger.update({
        where: { id: triggerId },
        data: { deliveryStatus: "suppressed" },
      });
      return;
    }
    const operator = event.condition.endsWith("_ABOVE") ? ">" : "<";
    const metric = event.condition.startsWith("PRICE_")
      ? "Price"
      : event.condition.startsWith("RSI_")
        ? "RSI"
        : "Candle change";
    const format = (value: { toString(): string }) =>
      Number(value.toString()).toLocaleString("en-US", {
        maximumFractionDigits: 8,
      });
    await tx.notification.upsert({
      where: { triggerId },
      update: {},
      create: {
        triggerId,
        userId: event.userId,
        category: "MARKET_ALERT",
        title: `${event.assetId} alert triggered`,
        body: `${metric} ${operator} ${format(event.threshold)} ${event.unit}. Observed ${format(event.value)} ${event.unit} at ${event.observationAt.toISOString()} (${event.interval}, ${event.priceKind === "quote" ? "provider quote" : "completed candle close"}). Source: ${event.source} · ${event.providerSymbol}.`,
        actionPath: `/dashboard/alerts?alert=${event.alertId}`,
      },
    });
    await tx.alertTrigger.update({
      where: { id: triggerId },
      data: {
        deliveryStatus: "delivered",
        failureCode: null,
        deliveredAt: new Date(),
      },
    });
    return true;
  });
  if (delivered) console.log(JSON.stringify({ event: "alert_inbox_delivered", triggerId }));
}
