import { Prisma, type PrismaClient } from "@marketpilot/db";
import { validateRule } from "@marketpilot/jobs";
import { metricFromObservation } from "./alert-observation.js";

export async function evaluateObservation(db: PrismaClient, observationId: string) {
  const batch = await db.alertObservation.findUnique({
    where: { id: observationId },
  });
  if (!batch || batch.completedAt) return;
  const rules = await db.alert.findMany({
    where: {
      enabled: true,
      assetId: batch.symbol,
      interval: batch.interval,
      user: { status: "ACTIVE" },
    },
    select: { id: true, userId: true },
  });
  for (const { id, userId } of rules) {
    const trigger = await db.$transaction(async (tx) => {
      // Lock the owner before the rule, matching bot delivery/link lock order. The later
      // outbox foreign-key insert needs this shared lock; acquiring it first avoids a cycle.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR KEY SHARE`;
      // Serialize evaluation, edits, pauses and deletion on the same database row.
      await tx.$queryRaw`SELECT id FROM "Alert" WHERE id = ${id}::uuid FOR UPDATE`;
      const rule = await tx.alert.findUnique({
        where: { id },
        include: { user: { select: { status: true } } },
      });
      if (
        !rule?.enabled ||
        rule.user.status !== "ACTIVE" ||
        rule.assetId !== batch.symbol ||
        rule.interval !== batch.interval ||
        batch.fetchedAt < rule.createdAt
      )
        return;
      const validRule = validateRule({
        ...rule,
        threshold: Number(rule.threshold),
      });
      const metric = validRule
        ? metricFromObservation(batch.payload, rule.assetId, rule.interval, rule.condition, batch.fetchedAt)
        : "INVALID_RULE";
      const evaluatedAt = new Date();
      if (typeof metric === "string") {
        await tx.alert.update({
          where: { id },
          data: { lastEvaluatedAt: evaluatedAt, evaluationReason: metric },
        });
        return;
      }
      if (rule.lastObservationAt && metric.observationAt <= rule.lastObservationAt) {
        await tx.alert.update({
          where: { id },
          data: {
            lastEvaluatedAt: evaluatedAt,
            evaluationReason:
              metric.observationAt < rule.lastObservationAt
                ? "OLDER_OBSERVATION_SKIPPED"
                : rule.matched
                  ? "CONDITION_MATCHED"
                  : "ARMED",
          },
        });
        return;
      }
      // Do not evaluate observations fetched before a rule edit/resume.
      if (batch.fetchedAt < rule.updatedAt && rule.lastObservationAt === null) return;
      const matched = rule.condition.endsWith("_ABOVE")
        ? metric.value > Number(rule.threshold)
        : metric.value < Number(rule.threshold);
      const crossing = rule.matched === false && matched;
      const cooldownOver =
        !rule.lastTriggeredAt || evaluatedAt.getTime() - rule.lastTriggeredAt.getTime() >= rule.cooldownMinutes * 60000;
      const trigger = crossing && cooldownOver;
      await tx.alert.update({
        where: { id },
        data: {
          lastEvaluatedAt: evaluatedAt,
          lastObservationAt: metric.observationAt,
          lastValue: new Prisma.Decimal(metric.value),
          matched,
          evaluationReason:
            rule.matched === null
              ? "BASELINE"
              : trigger
                ? "TRIGGERED"
                : crossing
                  ? "COOLDOWN"
                  : matched
                    ? "CONDITION_MATCHED"
                    : "ARMED",
          ...(trigger ? { lastTriggeredAt: evaluatedAt } : {}),
        },
      });
      if (trigger) {
        const event = await tx.alertTrigger.create({
          data: {
            alertId: id,
            userId: rule.userId,
            assetId: rule.assetId,
            condition: rule.condition,
            threshold: rule.threshold,
            interval: rule.interval,
            value: new Prisma.Decimal(metric.value),
            observationAt: metric.observationAt,
            triggeredAt: evaluatedAt,
            source: metric.source,
            providerSymbol: metric.providerSymbol,
            priceKind: metric.priceKind,
            unit: metric.unit,
          },
        });
        const channels = await tx.notificationChannel.findMany({
          where: {
            userId: rule.userId,
            provider: { in: ["TELEGRAM", "DISCORD"] },
            active: true,
            verifiedAt: { not: null },
            externalAccountId: { not: null },
          },
        });
        for (const channel of channels) {
          const preferences = channel.preferences;
          if (
            !channel.externalAccountId ||
            !channel.verifiedAt ||
            !preferences ||
            typeof preferences !== "object" ||
            Array.isArray(preferences) ||
            preferences.marketAlerts !== true
          )
            continue;
          await tx.externalDelivery.create({
            data: {
              triggerId: event.id,
              userId: rule.userId,
              channelId: channel.id,
              provider: channel.provider,
              destination: channel.externalAccountId,
              linkedAt: channel.verifiedAt,
            },
          });
        }
        return event;
      }
    });
    if (trigger)
      console.log(
        JSON.stringify({ event: "alert_trigger_persisted", observationId, alertId: id, triggerId: trigger.id }),
      );
  }
  await db.alertObservation.updateMany({
    where: { id: observationId, completedAt: null },
    data: { completedAt: new Date(), failureCode: null },
  });
}
