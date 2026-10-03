import { TradeSetupSchema } from "@marketpilot/ai";
import type { Prisma } from "@marketpilot/db";
import type { MarketSnapshot } from "../market-data/market-data.service";

export const candleDurations = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3600_000,
  "6h": 21600_000,
  "1d": 86400_000,
};
type Entry = Prisma.JournalEntryGetPayload<{ include: { exits: true; events: true } }>;
export async function trackAutomatic(tx: Prisma.TransactionClient, entry: Entry, snapshot: MarketSnapshot) {
  const plan = TradeSetupSchema.parse(entry.plan);
  const duration = candleDurations[plan.interval];
  const start = entry.checkedAt?.getTime() ?? entry.openedAt?.getTime() ?? entry.createdAt.getTime();
  const candles = snapshot.data.candles.filter(
    (c) => Date.parse(c.time) >= start && Date.parse(c.time) + duration <= Date.now(),
  );
  const seen = new Set(entry.events.map((e) => e.key));
  if (seen.has("ambiguous") || seen.has("auto-gap")) return;
  const event = async (key: string, kind: string, time: Date, message: string, price?: number) => {
    if (seen.has(key)) return;
    seen.add(key);
    await tx.journalEvent.create({
      data: {
        entryId: entry.id,
        key,
        kind,
        occurredAt: time,
        evidence: { message, price, source: snapshot.source, interval: plan.interval },
        reviewStatus: kind === "gap" ? "not_needed" : "pending",
      },
    });
  };
  const partial = snapshot.data.candles.find(
    (c) =>
      Date.parse(c.time) < start &&
      Date.parse(c.time) + duration > start &&
      Date.parse(c.time) + duration <= Date.now(),
  );
  if (partial) {
    const stop = plan.direction === "BUY" ? partial.low <= plan.stopLoss : partial.high >= plan.stopLoss;
    const target = plan.targets.some((price) =>
      plan.direction === "BUY" ? partial.high >= price : partial.low <= price,
    );
    const touch = partial.low <= plan.entry && partial.high >= plan.entry;
    if (
      (entry.status === "open" && (stop || target)) ||
      (entry.status === "planned" && entry.entryTrigger === "touch" && (touch || stop))
    ) {
      await event(
        "ambiguous",
        "ambiguous",
        new Date(Date.parse(partial.time) + duration),
        "The start time falls inside a candle that reached a relevant level. The event may have happened before the trade started; automatic tracking is paused for review.",
      );
      await tx.journalEntry.update({
        where: { id: entry.id },
        data: { monitoringStatus: "Needs review · start candle timing unknown" },
      });
      return;
    }
  }
  const availableStart = snapshot.data.candles[0] ? Date.parse(snapshot.data.candles[0].time) : null;
  if (availableStart !== null && start + duration < availableStart) {
    await event(
      "auto-gap",
      "gap",
      new Date(),
      "Historical candles do not cover this trade. Automatic results are paused; import executions or review the missing period.",
    );
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: { monitoringStatus: "Needs review · historical data gap" },
    });
    return;
  }
  let status = entry.status;
  let entryPrice = entry.entryPrice;
  let cursor = start;
  const allocations = Array.isArray(entry.targetAllocations)
    ? entry.targetAllocations.filter((n): n is number => typeof n === "number")
    : [];
  const quantity = entry.quantity;
  if (!quantity || allocations.length !== plan.targets.length) return;
  let exits = [...entry.exits];
  for (const candle of candles) {
    const openTime = Date.parse(candle.time);
    const time = new Date(openTime + duration);
    if (openTime > cursor + duration) {
      await event(
        "auto-gap",
        "gap",
        time,
        "A gap exists between completed candles. Automatic results are paused; no missing outcome was inferred.",
      );
      await tx.journalEntry.update({
        where: { id: entry.id },
        data: { monitoringStatus: "Needs review · candle gap" },
      });
      return;
    }
    if (status === "planned" && time.getTime() > Date.parse(plan.expiresAt)) break;
    const long = plan.direction === "BUY";
    const stop = long ? candle.low <= plan.stopLoss : candle.high >= plan.stopLoss;
    const targets = plan.targets.flatMap((price, i) =>
      !exits.some((e) => e.key === `auto:tp:${i}`) && (long ? candle.high >= price : candle.low <= price)
        ? [{ price, i }]
        : [],
    );
    if (status === "planned") {
      const touched =
        entry.entryTrigger === "close_above"
          ? candle.close >= plan.entry
          : entry.entryTrigger === "close_below"
            ? candle.close <= plan.entry
            : candle.low <= plan.entry && candle.high >= plan.entry;
      if (touched && (stop || targets.length)) {
        await event(
          "ambiguous",
          "ambiguous",
          time,
          "Entry and an exit level were reached in the same candle. Their order is unknown; review this plan.",
        );
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: { monitoringStatus: "Needs review · entry/exit order unknown" },
        });
        return;
      }
      if (stop) {
        status = "expired";
        await event(
          "invalidated",
          "invalidated",
          time,
          "Stop level reached before entry. This unexecuted plan was invalidated.",
          plan.stopLoss,
        );
        break;
      }
      if (touched) {
        status = "open";
        entryPrice = entry.entryTrigger === "touch" ? plan.entry : candle.close;
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: { status, entryPrice, openedAt: time, resultBasis: "estimated" },
        });
        await event(
          "auto:entry",
          "entry",
          time,
          "Entry condition met on a completed candle. Journal entry is an estimate, not a broker execution.",
          entryPrice,
        );
      }
    } else if (status === "open") {
      if (stop && targets.length) {
        await event(
          "ambiguous",
          "ambiguous",
          time,
          "SL and TP were reached in the same candle. Automatic closing is paused because their order is unknown.",
        );
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: { monitoringStatus: "Needs review · SL/TP order unknown" },
        });
        return;
      }
      const remaining = quantity - exits.reduce((sum, exit) => sum + exit.quantity, 0);
      const candidates = stop
        ? [{ price: plan.stopLoss, quantity: remaining, key: "auto:sl", reason: "sl" }]
        : targets.map((target) => ({
            price: target.price,
            quantity: (quantity * allocations[target.i]) / 100,
            key: `auto:tp:${target.i}`,
            reason: "tp",
          }));
      for (const fill of candidates) {
        const left = quantity - exits.reduce((sum, e) => sum + e.quantity, 0);
        if (left <= quantity * 1e-9) break;
        // Gap opens use the observed open instead of a fictitious stop/limit fill.
        const price = stop
          ? long
            ? Math.min(fill.price, candle.open)
            : Math.max(fill.price, candle.open)
          : fill.price;
        const exit = await tx.journalExit.create({
          data: {
            entryId: entry.id,
            key: fill.key,
            price,
            quantity: Math.min(left, fill.quantity),
            fees: 0,
            reason: fill.reason,
            basis: "estimated",
            occurredAt: time,
          },
        });
        exits.push(exit);
        await event(
          fill.key,
          fill.reason,
          time,
          `Automatic ${fill.reason.toUpperCase()} estimate: ${exit.quantity} units at ${price}. Slippage and exit fees are not known.`,
          price,
        );
      }
      if (quantity - exits.reduce((sum, e) => sum + e.quantity, 0) <= quantity * 1e-9) {
        status = "closed";
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: {
            closedAt: time,
            exitPrice: exits.reduce((sum, e) => sum + e.price * e.quantity, 0) / quantity,
          },
        });
        cursor = time.getTime();
        break;
      }
    }
    cursor = time.getTime();
  }
  if (
    status === "planned" &&
    Date.now() >= Date.parse(plan.expiresAt) &&
    cursor + duration >= Date.parse(plan.expiresAt)
  ) {
    status = "expired";
    await event(
      "expired",
      "expired",
      new Date(plan.expiresAt),
      "Entry did not occur before the configured validity ended. Plan expired.",
    );
  }
  await tx.journalEntry.update({
    where: { id: entry.id },
    data: {
      status,
      checkedAt: new Date(cursor),
      ...(exits.length ? { resultBasis: "estimated" } : {}),
      monitoringStatus:
        status === "expired"
          ? "Entry window ended"
          : status === "closed"
            ? "Automatic result · verify against broker executions"
            : "Automatic tracking · completed candles checked",
    },
  });
}
