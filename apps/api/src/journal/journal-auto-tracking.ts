import {
  assessTradeEconomics,
  entryConditionMet,
  entryDeadline,
  entryDurations,
  profitProtectionLevel,
  TradeContextSchema,
  TradeSetupSchema,
} from "@marketpilot/ai";
import type { Prisma } from "@marketpilot/db";
import { completedSnapshotCandles } from "../market-data/completed-candles";
import type { MarketSnapshot } from "../market-data/market-data.service";
import { estimatedExitFees } from "./simulation-costs";

export const candleDurations = entryDurations;
type Entry = Prisma.JournalEntryGetPayload<{ include: { exits: true; events: true } }>;
export async function trackAutomatic(
  tx: Prisma.TransactionClient,
  entry: Entry,
  snapshot: MarketSnapshot,
  confirmation?: MarketSnapshot,
) {
  const plan = TradeSetupSchema.parse(entry.plan);
  const duration = confirmation ? candleDurations["1m"] : candleDurations[plan.interval];
  const simulated = entry.source === "ai" || !!plan.conditionalEntry;
  const start = entry.checkedAt?.getTime() ?? entry.openedAt?.getTime() ?? entry.createdAt.getTime();
  const evaluatedAt = Date.now();
  const completed = completedSnapshotCandles(snapshot, evaluatedAt);
  const confirmations = confirmation ? completedSnapshotCandles(confirmation, evaluatedAt) : [];
  const analysisDuration = candleDurations[plan.interval];
  const candleOffsetMs =
    plan.conditionalEntry?.candleOffsetMs ??
    (confirmation?.data.candles[0] ? Date.parse(confirmation.data.candles[0].time) % analysisDuration : 0);
  let candles = completed.filter((c) => Date.parse(c.time) >= start);
  const reset = entry.events
    .filter((event) => {
      const evidence = event.evidence;
      return (
        typeof evidence === "object" &&
        evidence !== null &&
        !Array.isArray(evidence) &&
        evidence.monitoringReset === true
      );
    })
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())[0];
  const prefix = reset ? `monitor:${reset.occurredAt.toISOString()}:` : "";
  const seen = new Set(
    entry.events
      .filter((event) => !reset || event.key.startsWith(prefix) || !["ambiguous", "auto-gap"].includes(event.key))
      .map((event) => (event.key.startsWith(prefix) ? event.key.slice(prefix.length) : event.key)),
  );
  if (!simulated && (seen.has("ambiguous") || seen.has("auto-gap"))) return;
  const closeCondition = plan.conditionalEntry
    ? plan.conditionalEntry.condition !== "touch"
    : entry.entryTrigger !== "touch";
  const requiresRetest =
    plan.conditionalEntry?.scenario === "pullback" || plan.conditionalEntry?.condition === "break_retest";
  const initialBreakoutKnown = !!plan.conditionalEntry?.breakoutAt || seen.has("auto:breakout");
  const event = async (key: string, kind: string, time: Date, message: string, price?: number) => {
    const eventKey =
      simulated && ["ambiguous", "gap"].includes(kind) ? `${key}:${kind === "gap" ? start : time.getTime()}` : key;
    if (seen.has(eventKey)) return;
    seen.add(eventKey);
    await tx.journalEvent.create({
      data: {
        entryId: entry.id,
        key: reset && ["ambiguous", "auto-gap"].includes(key) ? `${prefix}${eventKey}` : eventKey,
        kind,
        occurredAt: time,
        evidence: {
          message,
          price,
          source:
            closeCondition && ["entry", "breakout"].includes(kind)
              ? (confirmation ?? snapshot).source
              : snapshot.source,
          interval: closeCondition && ["entry", "breakout"].includes(kind) ? plan.interval : snapshot.data.interval,
        },
        reviewStatus: ["gap", "entry", "breakout", "retest"].includes(kind) ? "not_needed" : "pending",
      },
    });
  };
  const partial = completed.find((c) => Date.parse(c.time) < start && Date.parse(c.time) + duration > start);
  if (partial) {
    const stop = plan.direction === "BUY" ? partial.low <= plan.stopLoss : partial.high >= plan.stopLoss;
    const target = plan.targets.some((price) =>
      plan.direction === "BUY" ? partial.high >= price : partial.low <= price,
    );
    const protection = profitProtectionLevel(plan, entry.entryPrice ?? plan.entry);
    const effectiveAt = plan.conditionalEntry?.profitProtection?.effectiveAt;
    const armed = entry.exits.some(
      (exit) =>
        (exit.key === "auto:tp:0" ||
          (exit.reason === "tp" &&
            (plan.direction === "BUY" ? exit.price >= plan.targets[0] : exit.price <= plan.targets[0]))) &&
        exit.occurredAt.getTime() <= start,
    );
    const protectedTouch =
      protection !== null &&
      !!effectiveAt &&
      Date.parse(effectiveAt) <= start &&
      armed &&
      (plan.direction === "BUY" ? partial.low <= protection : partial.high >= protection);
    const touch = partial.low <= plan.entry && partial.high >= plan.entry;
    if (
      (entry.status === "open" && (stop || target || protectedTouch)) ||
      (entry.status === "planned" && (stop || ((!closeCondition || (requiresRetest && initialBreakoutKnown)) && touch)))
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
  if (partial && entry.status === "planned" && closeCondition) candles = [partial, ...candles];
  const availableStart = snapshot.data.candles[0] ? Date.parse(snapshot.data.candles[0].time) : null;
  if (availableStart !== null && Math.floor(start / duration) * duration < availableStart) {
    await event(
      "auto-gap",
      "gap",
      new Date(),
      "Historical candles do not cover this trade. Automatic results are paused; review the missing period.",
    );
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: { monitoringStatus: "Needs review · historical data gap" },
    });
    return;
  }
  if (
    entry.status === "planned" &&
    closeCondition &&
    confirmation &&
    plan.conditionalEntry?.candleOffsetMs === undefined &&
    !confirmation.data.candles.length
  ) {
    await event(
      "confirmation-gap:unknown",
      "gap",
      new Date(),
      "Entry-timeframe candle boundaries are unavailable. Tracking is paused until the actual confirmation grid is known.",
    );
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: {
        status: entry.status,
        checkedAt: new Date(start),
        monitoringStatus: "Waiting for completed entry-timeframe data",
      },
    });
    return;
  }
  let status = entry.status;
  let entryPrice = entry.entryPrice;
  let cursor = start;
  const allocations = Array.isArray(entry.targetAllocations)
    ? entry.targetAllocations.filter((n): n is number => typeof n === "number")
    : [];
  // Unsized simulations use a reference unit internally; quantity stays null so monetary analytics exclude them.
  const quantity = entry.quantity ?? (simulated ? 1 : null);
  let breakoutSeen = initialBreakoutKnown;
  if (!quantity || allocations.length !== plan.targets.length) return;
  const exits = [...entry.exits];
  for (const candle of candles) {
    const openTime = Date.parse(candle.time);
    const time = new Date(openTime + duration);
    if (openTime > Math.ceil(cursor / duration) * duration) {
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
    if (status === "planned" && time.getTime() > Date.parse(plan.expiresAt)) {
      const deadline = Date.parse(plan.expiresAt);
      if (openTime < deadline) {
        const stopTouched = plan.direction === "BUY" ? candle.low <= plan.stopLoss : candle.high >= plan.stopLoss;
        const entryTouched = candle.low <= plan.entry && candle.high >= plan.entry;
        const touchCondition = plan.conditionalEntry
          ? plan.conditionalEntry.condition === "touch"
          : entry.entryTrigger === "touch";
        if (stopTouched || (touchCondition && entryTouched)) {
          await event(
            `deadline:${openTime}`,
            "ambiguous",
            time,
            "A relevant level was touched inside the minute containing the entry deadline. Its timing is unknown; the simulation remains paused for review.",
          );
          await tx.journalEntry.update({
            where: { id: entry.id },
            data: { monitoringStatus: "Needs review · deadline minute timing unknown" },
          });
          return;
        }
        cursor = time.getTime();
      }
      break;
    }
    const long = plan.direction === "BUY";
    const stop = long ? candle.low <= plan.stopLoss : candle.high >= plan.stopLoss;
    const targets = plan.targets.flatMap((price, i) =>
      !exits.some((e) => e.key === `auto:tp:${i}`) && (long ? candle.high >= price : candle.low <= price)
        ? [{ price, i }]
        : [],
    );
    if (status === "planned") {
      const confirmationCandle = confirmations.find(
        (c) => Date.parse(c.time) + candleDurations[plan.interval] === time.getTime(),
      );
      const signalCandle = closeCondition && confirmation ? confirmationCandle : candle;
      const periodEnd = entryDeadline(openTime, plan.interval, 1, "entry_candle_closes", candleOffsetMs);
      const retestKey = `auto:retest:${periodEnd}`;
      // Never count a partial start minute as proof of a retest after saving.
      if (confirmation && openTime >= start && breakoutSeen && candle.low <= plan.entry && candle.high >= plan.entry)
        await event(retestKey, "retest", time, "Entry retest observed after simulation start.", plan.entry);
      if (confirmation && closeCondition && time.getTime() === periodEnd && !confirmationCandle && !stop) {
        await event(
          `confirmation-gap:${periodEnd}`,
          "gap",
          time,
          "The completed entry-timeframe candle is unavailable. Tracking will retry this boundary before inferring entry or expiry.",
        );
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: { checkedAt: new Date(cursor), monitoringStatus: "Waiting for completed entry-timeframe data" },
        });
        return;
      }
      const touched =
        !!signalCandle &&
        (!confirmation || !closeCondition || !requiresRetest || seen.has(retestKey)) &&
        entryConditionMet(plan, signalCandle, breakoutSeen, entry.entryTrigger);
      if (
        signalCandle &&
        plan.conditionalEntry?.condition === "break_retest" &&
        !breakoutSeen &&
        (long ? signalCandle.close > plan.entry : signalCandle.close < plan.entry)
      ) {
        breakoutSeen = true;
        await event(
          "auto:breakout",
          "breakout",
          time,
          "Completed analysis candle confirmed a break; a later retest is required.",
          signalCandle.close,
        );
      }
      if (touched && !closeCondition && (stop || targets.length)) {
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
      if (touched && signalCandle) {
        entryPrice = closeCondition ? signalCandle.close : plan.entry;
        const economics = plan.conditionalEntry?.economics;
        if (economics) {
          const quality = assessTradeEconomics(
            { ...plan, entry: entryPrice },
            economics.roundTripCostPercent,
            economics.minimumNetRewardRisk,
            allocations,
          );
          const context = TradeContextSchema.safeParse(entry.context);
          const unaffordable =
            quality.accepted &&
            entry.quantity !== null &&
            context.success &&
            context.data.capital !== null &&
            context.data.currency === plan.quote &&
            ((entryPrice + quality.economics.costPerUnit) * quantity > context.data.capital * (1 + 1e-9) ||
              quality.economics.stopRiskPerUnit * quantity >
                ((context.data.capital * context.data.riskPercent) / 100) * (1 + 1e-9));
          if (!quality.accepted || unaffordable) {
            status = "cancelled";
            await event(
              "quality-rejected",
              "invalidated",
              time,
              !quality.accepted
                ? quality.reason
                : "Entry confirmation exceeds the supplied capital or loss budget. No simulated position was opened.",
              entryPrice,
            );
            entryPrice = null;
            break;
          }
        }
        status = "open";
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: { status, entryPrice, openedAt: time, resultBasis: "estimated" },
        });
        await event(
          "auto:entry",
          "entry",
          time,
          "Entry condition met on a completed candle. Simulated position opened automatically.",
          entryPrice,
        );
      }
    } else if (status === "open") {
      const protection = profitProtectionLevel(plan, entryPrice ?? plan.entry);
      const effectiveAt = plan.conditionalEntry?.profitProtection?.effectiveAt;
      const activation = effectiveAt ? Date.parse(effectiveAt) : null;
      const activatedInsideCandle = activation !== null && activation > openTime && activation < time.getTime();
      const enabled = protection !== null && activation !== null && openTime >= activation;
      const protectionTouched = enabled && (long ? candle.low <= protection : candle.high >= protection);
      const firstTarget = exits.find(
        (exit) =>
          exit.key === "auto:tp:0" ||
          (exit.reason === "tp" && (long ? exit.price >= plan.targets[0] : exit.price <= plan.targets[0])),
      );
      const armed = !!firstTarget && Date.parse(String(firstTarget.occurredAt)) <= openTime;
      if (
        armed &&
        activatedInsideCandle &&
        protection !== null &&
        (long ? candle.low <= protection : candle.high >= protection)
      ) {
        await event(
          "ambiguous",
          "ambiguous",
          time,
          "The protection activation time falls inside a candle that touched the protection level. Its timing is unknown; no retrospective exit was inferred.",
        );
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: { monitoringStatus: "Needs review · protection activation timing unknown" },
        });
        return;
      }
      if (protectionTouched && !armed && allocations[0] < 100 && targets.some((target) => target.i === 0)) {
        await event(
          "ambiguous",
          "ambiguous",
          time,
          "TP1 and the profit-protection level were reached in the same candle. Their order is unknown; remaining exits require review.",
        );
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: { monitoringStatus: "Needs review · TP1/protection order unknown" },
        });
        return;
      }
      const protectedExit = protectionTouched && armed;
      const stopped = stop || protectedExit;
      const stopPrice = protectedExit && protection !== null ? protection : plan.stopLoss;
      if (stopped && targets.length) {
        await event(
          "ambiguous",
          "ambiguous",
          time,
          "An active stop and TP were reached in the same candle. Simulation closing is paused because their order is unknown.",
        );
        await tx.journalEntry.update({
          where: { id: entry.id },
          data: { monitoringStatus: "Needs review · SL/TP order unknown" },
        });
        return;
      }
      const remaining = quantity - exits.reduce((sum, exit) => sum + exit.quantity, 0);
      const candidates = stopped
        ? [
            {
              price: stopPrice,
              quantity: remaining,
              key: protectedExit ? "auto:protection" : "auto:sl",
              reason: protectedExit ? "protection" : "sl",
            },
          ]
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
        const price = stopped
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
            fees: estimatedExitFees(
              plan,
              entryPrice ?? plan.entry,
              quantity,
              entry.fees,
              Math.min(left, fill.quantity),
            ),
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
          `Simulated ${fill.reason.toUpperCase()} at ${price}. ${entry.quantity === null ? "Return is measured as a percentage; no capital was supplied." : plan.conditionalEntry?.economics ? "Budgeted round-trip costs are allocated to this exit; actual market costs may differ." : "Simulation fees are zero."}`,
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
  if (status === "planned" && evaluatedAt >= Date.parse(plan.expiresAt) && cursor >= Date.parse(plan.expiresAt)) {
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
        status === "cancelled"
          ? "Entry rejected by economic or capital checks"
          : status === "expired"
            ? "Entry window ended"
            : status === "closed"
              ? "Simulation completed"
              : "Simulation active · completed candles checked",
    },
  });
}
