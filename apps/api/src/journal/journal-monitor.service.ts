import { TradeSetupSchema } from "@marketpilot/ai";
import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../database.module";
import { MarketDataService } from "../market-data/market-data.service";
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
          await this.db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${entry.id}::uuid FOR UPDATE`;
            const current = await tx.journalEntry.findUniqueOrThrow({
              where: { id: entry.id },
              include: { events: true },
            });
            if (!["planned", "open"].includes(current.status)) return;
            const start = Math.max(
              current.checkedAt?.getTime() ?? current.createdAt.getTime(),
              current.openedAt?.getTime() ?? 0,
            );
            const completed = snapshot.data.candles.filter(
              (c) => Date.parse(c.time) >= start && Date.parse(c.time) + durations[plan.interval] <= Date.now(),
            );
            const seen = new Set(current.events.map((e) => e.key));
            if (seen.has("stop") || seen.has("ambiguous") || seen.has(`target:${plan.targets.length - 1}`)) {
              await tx.journalEntry.update({
                where: { id: entry.id },
                data: {
                  monitoringStatus: "Terminal price event observed; confirm your actual exit",
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
                  key,
                  kind,
                  occurredAt: time,
                  evidence: { message, ...(price ? { price } : {}), interval: plan.interval, source: snapshot.source },
                  reviewStatus: kind === "gap" || kind === "entry" ? "not_needed" : "pending",
                },
              });
            };
            if (
              snapshot.data.candles.length &&
              start + durations[plan.interval] < Date.parse(snapshot.data.candles[0].time)
            )
              await add(
                `gap:${snapshot.data.candles[0].time}`,
                "gap",
                new Date(),
                "Part of the monitoring window is no longer available; no outcome was inferred for that period.",
              );
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
                if (candle.low <= plan.entry && candle.high >= plan.entry)
                  await add(
                    "entry",
                    "entry",
                    time,
                    "Entry level touched by a completed candle. Entry conditions and execution are not confirmed.",
                    plan.entry,
                  );
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
                  "Stop and target were touched in the same candle; their order is unknown. Confirm your actual exit.",
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
                monitoringStatus:
                  snapshot.data.candles.length && start < Date.parse(snapshot.data.candles[0].time)
                    ? "Monitoring gap recorded"
                    : "Completed candles checked; executions require confirmation",
              },
            });
          });
        } catch {
          await this.db.journalEntry.update({
            where: { id: entry.id },
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
