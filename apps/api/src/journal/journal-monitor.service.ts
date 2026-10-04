import { TradeSetupSchema, entryConditionMet } from "@marketpilot/ai";
import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../database.module";
import { MarketDataService } from "../market-data/market-data.service";
import { trackAutomatic } from "./journal-auto-tracking";
import { JournalService } from "./journal.service";
const durations = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3600_000, "6h": 21600_000, "1d": 86400_000 };
@Injectable()
export class JournalMonitorService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private monitoring = false;
  constructor(
    private readonly db: DatabaseService,
    private readonly market: MarketDataService,
    private readonly journal: JournalService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(
      () => void this.monitor().catch(() => console.warn(JSON.stringify({ event: "journal_monitor_unavailable" }))),
      65_000,
    );
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async monitor() {
    if (this.monitoring) return;
    this.monitoring = true;
    try {
      await this.journal.expirePlans();
      // Each pass is bounded; older checks come first. Row locks and event keys also protect multiple API instances.
      const entries = await this.db.journalEntry.findMany({
        where: {
          status: { in: ["planned", "open"] },
          OR: [{ checkedAt: null }, { checkedAt: { lt: new Date(Date.now() - 60_000) } }],
        },
        orderBy: { updatedAt: "asc" },
        take: 20,
      });
      for (const entry of entries) {
        const parsed = TradeSetupSchema.safeParse(entry.plan);
        if (!parsed.success) continue;
        const plan = parsed.data;
        try {
          const snapshot = await this.market.getMarketData(entry.symbol, plan.interval);
          if (snapshot.freshness !== "fresh") throw new Error("Fresh market data unavailable.");
          if (
            !snapshot.data.candles.every((candle, index, candles) => {
              const time = Date.parse(candle.time);
              return (
                Number.isFinite(time) &&
                [candle.open, candle.high, candle.low, candle.close].every(
                  (price) => Number.isFinite(price) && price > 0,
                ) &&
                candle.low <= Math.min(candle.open, candle.close) &&
                candle.high >= Math.max(candle.open, candle.close) &&
                (!index || time > Date.parse(candles[index - 1].time))
              );
            })
          )
            throw new Error("Valid ordered candles are required for tracking.");
          const fine =
            entry.trackingMode === "automatic" && plan.conditionalEntry
              ? plan.interval === "1m"
                ? snapshot
                : await this.market.getMarketData(entry.symbol, "1m")
              : null;
          if (
            fine &&
            (fine.freshness !== "fresh" ||
              fine.data.symbol !== entry.symbol ||
              fine.data.interval !== "1m" ||
              !fine.data.candles.every(
                (c, i, candles) =>
                  Number.isFinite(Date.parse(c.time)) &&
                  [c.open, c.high, c.low, c.close].every((p) => Number.isFinite(p) && p > 0) &&
                  c.low <= Math.min(c.open, c.close) &&
                  c.high >= Math.max(c.open, c.close) &&
                  (!i || Date.parse(c.time) - Date.parse(candles[i - 1].time) > 0),
              ))
          )
            throw new Error("Fresh valid one-minute simulation data unavailable.");
          await this.db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${entry.id}::uuid FOR UPDATE`;
            const current = await tx.journalEntry.findUniqueOrThrow({
              where: { id: entry.id },
              include: { events: true, exits: true },
            });
            if (!["planned", "open"].includes(current.status)) return;
            // The request preceded the lock; edited plans need a fresh provider request.
            if (current.symbol !== entry.symbol || JSON.stringify(current.plan) !== JSON.stringify(entry.plan)) return;
            if (current.trackingMode === "automatic") {
              await trackAutomatic(tx, current, fine ?? snapshot, fine ? snapshot : undefined);
              return;
            }
            const start = Math.max(
              current.checkedAt?.getTime() ?? current.createdAt.getTime(),
              current.openedAt?.getTime() ?? 0,
            );
            const completed = snapshot.data.candles.filter(
              (c) => Date.parse(c.time) >= start && Date.parse(c.time) + durations[plan.interval] <= Date.now(),
            );
            const reset = current.events
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
            const epoch =
              reset && (!current.openedAt || reset.occurredAt > current.openedAt) ? reset.occurredAt : current.openedAt;
            const prefix = epoch ? `monitor:${epoch.toISOString()}:` : "";
            const seen = new Set(
              current.events
                .filter((event) => event.key.startsWith(prefix))
                .map((event) => event.key.slice(prefix.length)),
            );
            if (seen.has("stop") || seen.has("ambiguous") || seen.has(`target:${plan.targets.length - 1}`)) {
              await tx.journalEntry.update({
                where: { id: entry.id },
                data: {
                  monitoringStatus: seen.has("ambiguous")
                    ? "Needs review · event order unknown; finer data or actual execution required"
                    : "Terminal price event observed; confirm your actual exit",
                  checkedAt: new Date(),
                },
              });
              return;
            }
            const add = async (key: string, kind: string, time: Date, message: string, price?: number) => {
              if (seen.has(key)) return;
              seen.add(key);
              await tx.journalEvent.create({
                data: {
                  entryId: entry.id,
                  key: `${prefix}${key}`,
                  kind,
                  occurredAt: time,
                  evidence: { message, ...(price ? { price } : {}), interval: plan.interval, source: snapshot.source },
                  reviewStatus: kind === "gap" || kind === "entry" ? "not_needed" : "pending",
                },
              });
            };
            const partial = snapshot.data.candles.find(
              (candle) =>
                Date.parse(candle.time) < start &&
                Date.parse(candle.time) + durations[plan.interval] > start &&
                Date.parse(candle.time) + durations[plan.interval] <= Date.now(),
            );
            if (partial) {
              const stop = plan.direction === "BUY" ? partial.low <= plan.stopLoss : partial.high >= plan.stopLoss;
              const target = plan.targets.some((price) =>
                plan.direction === "BUY" ? partial.high >= price : partial.low <= price,
              );
              const entryTouched = partial.low <= plan.entry && partial.high >= plan.entry;
              if (
                (current.status === "open" && (stop || target)) ||
                (current.status === "planned" &&
                  (stop ||
                    ((plan.conditionalEntry?.condition === "touch" || plan.conditionalEntry?.scenario === "pullback") &&
                      entryTouched)))
              ) {
                await add(
                  "ambiguous",
                  "ambiguous",
                  new Date(Date.parse(partial.time) + durations[plan.interval]),
                  "The start time falls inside a candle that reached a relevant level. Timing cannot be proved; finer data or actual execution records are required.",
                );
                await tx.journalEntry.update({
                  where: { id: entry.id },
                  data: {
                    checkedAt: new Date(Date.parse(partial.time) + durations[plan.interval]),
                    monitoringStatus: "Needs review · start candle timing unknown",
                  },
                });
                return;
              }
              if (
                current.status === "planned" &&
                plan.conditionalEntry?.condition === "candle_close" &&
                plan.conditionalEntry.scenario !== "pullback" &&
                entryConditionMet(plan, partial) &&
                Date.parse(partial.time) + durations[plan.interval] <= Date.parse(plan.expiresAt)
              ) {
                await add(
                  "entry",
                  "entry",
                  new Date(Date.parse(partial.time) + durations[plan.interval]),
                  "Saved entry condition observed at candle close after plan creation. Actual execution remains unconfirmed.",
                  plan.entry,
                );
              }
            }
            if (
              plan.conditionalEntry &&
              ((completed[0] &&
                Date.parse(completed[0].time) >
                  Math.ceil(start / durations[plan.interval]) * durations[plan.interval]) ||
                completed.some(
                  (candle, index) =>
                    index > 0 &&
                    Date.parse(candle.time) - Date.parse(completed[index - 1].time) !== durations[plan.interval],
                ))
            ) {
              await add(
                "gap:conditional",
                "gap",
                new Date(),
                "A candle gap prevents validating the saved entry sequence. Finer or complete data is required.",
              );
              await tx.journalEntry.update({
                where: { id: entry.id },
                data: { monitoringStatus: "Needs review · candle gap" },
              });
              return;
            }
            if (
              snapshot.data.candles.length &&
              Math.floor(start / durations[plan.interval]) * durations[plan.interval] <
                Date.parse(snapshot.data.candles[0].time)
            ) {
              await add(
                `gap:${snapshot.data.candles[0].time}`,
                "gap",
                new Date(),
                "Part of the monitoring window is no longer available; no outcome was inferred for that period.",
              );
              if (plan.conditionalEntry) {
                await tx.journalEntry.update({
                  where: { id: entry.id },
                  data: { monitoringStatus: "Needs review · historical candle coverage missing" },
                });
                return;
              }
            }
            let breakoutSeen = seen.has("breakout") || !!plan.conditionalEntry?.breakoutAt;
            for (const candle of completed) {
              const time = new Date(Date.parse(candle.time) + durations[plan.interval]);
              if (current.status === "planned") {
                if (time.getTime() > Date.parse(plan.expiresAt)) {
                  await add(
                    "expired",
                    "expired",
                    new Date(plan.expiresAt),
                    "Plan validity ended. Reanalyse before using this entry.",
                  );
                  await tx.journalEntry.update({ where: { id: entry.id }, data: { status: "expired" } });
                  break;
                }
                const invalidated =
                  plan.direction === "BUY" ? candle.low <= plan.stopLoss : candle.high >= plan.stopLoss;
                const triggered = entryConditionMet(plan, candle, breakoutSeen, current.entryTrigger);
                if (triggered && invalidated) {
                  await add(
                    "ambiguous",
                    "ambiguous",
                    time,
                    "Entry condition and invalidation occurred in one candle. Their order cannot be proved; finer data or broker records are required.",
                  );
                  await tx.journalEntry.update({
                    where: { id: entry.id },
                    data: { monitoringStatus: "Needs review · entry/invalidation order unknown" },
                  });
                  break;
                }
                if (invalidated) {
                  await add(
                    "invalidated",
                    "invalidated",
                    time,
                    "Plan stop level touched before a recorded entry. Reanalyse before using this plan.",
                    plan.stopLoss,
                  );
                  await tx.journalEntry.update({ where: { id: entry.id }, data: { status: "expired" } });
                  break;
                }
                if (triggered)
                  await add(
                    "entry",
                    "entry",
                    time,
                    "Saved entry condition observed on a completed candle. Actual execution remains unconfirmed.",
                    plan.entry,
                  );
                if (
                  plan.conditionalEntry?.condition === "break_retest" &&
                  !breakoutSeen &&
                  (plan.direction === "BUY" ? candle.close > plan.entry : candle.close < plan.entry)
                ) {
                  await add(
                    "breakout",
                    "breakout",
                    time,
                    "Completed-candle break observed. A later candle must retest Entry and close on the breakout side.",
                    candle.close,
                  );
                  breakoutSeen = true;
                }
                continue;
              }
              const stop = plan.direction === "BUY" ? candle.low <= plan.stopLoss : candle.high >= plan.stopLoss;
              const targets = plan.targets.flatMap((target, i) =>
                (plan.direction === "BUY" ? candle.high >= target : candle.low <= target) ? [{ target, i }] : [],
              );
              if (stop && targets.length) {
                await add(
                  "ambiguous",
                  "ambiguous",
                  time,
                  "Stop and target were touched in the same candle; their order is unknown. Finer data or actual broker exits are required; no result is inferred.",
                );
                break;
              }
              if (stop) {
                await add(
                  "stop",
                  "stop",
                  time,
                  "Stop level touched. This is a market observation, not an execution confirmation.",
                  plan.stopLoss,
                );
                break;
              }
              for (const target of targets)
                await add(
                  `target:${target.i}`,
                  "target",
                  time,
                  `Target ${target.i + 1} touched. Record any actual partial exit in your notes.`,
                  target.target,
                );
              if (targets.some((t) => t.i === plan.targets.length - 1)) break;
            }
            const last = completed.at(-1);
            await tx.journalEntry.update({
              where: { id: entry.id },
              data: {
                checkedAt: last ? new Date(Date.parse(last.time) + durations[plan.interval]) : current.checkedAt,
                monitoringStatus: seen.has("ambiguous")
                  ? "Needs review · event order unknown; finer data required"
                  : snapshot.data.candles.length && start < Date.parse(snapshot.data.candles[0].time)
                    ? "Monitoring gap recorded"
                    : "Completed candles checked; executions require confirmation",
              },
            });
          });
        } catch {
          await this.db.journalEntry.updateMany({
            where: { id: entry.id, updatedAt: entry.updatedAt, status: { in: ["planned", "open"] } },
            data: { monitoringStatus: "Market observations unavailable; outcome not inferred" },
          });
        }
      }
      const reviews = await this.db.journalEvent.findMany({
        where: {
          reviewStatus: "pending",
          entry: { context: { path: ["autoReview"], equals: true }, user: { tradePreferences: { autoReview: true } } },
        },
        select: { id: true, entryId: true, entry: { select: { userId: true } } },
        take: 2,
        orderBy: { occurredAt: "asc" },
      });
      for (const event of reviews)
        await this.journal.review(event.entry.userId, event.entryId, event.id).catch(() => undefined);
    } finally {
      this.monitoring = false;
    }
  }
}
