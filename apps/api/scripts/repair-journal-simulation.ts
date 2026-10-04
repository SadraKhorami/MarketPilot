import "reflect-metadata";
import { config } from "dotenv";
import { TradeSetupSchema } from "@marketpilot/ai";
import { CoinbaseExchangeProvider } from "@marketpilot/market-data";
import { DatabaseService } from "../src/database.module";
import { RedisService } from "../src/redis.service";
import { MarketDataService } from "../src/market-data/market-data.service";
import { trackAutomatic } from "../src/journal/journal-auto-tracking";

// Explicit local repair; original levels and audit history are preserved.
config({ path: "../../.env", quiet: true });
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname))
  throw new Error("Simulation repair requires a local development database.");
const id = process.argv[2];
if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("Provide one journal entry UUID.");
const db = new DatabaseService();
const redis = new RedisService();
const market = new MarketDataService(new CoinbaseExchangeProvider(), redis);
async function main() {
  const saved = await db.journalEntry.findUniqueOrThrow({ where: { id } });
  const plan = TradeSetupSchema.parse(saved.plan);
  if (saved.source !== "ai" || !plan.conditionalEntry) throw new Error("Only a conditional AI simulation can be repaired.");
  const fine = await market.getMarketData(saved.symbol, "1m");
  const coarse = plan.interval === "1m" ? fine : await market.getMarketData(saved.symbol, plan.interval);
  if (fine.freshness !== "fresh" || coarse.freshness !== "fresh") throw new Error("Fresh candles required.");
  const first = fine.data.candles[0];
  if (!first || Date.parse(first.time) > Math.floor(saved.createdAt.getTime() / 60_000) * 60_000)
    throw new Error("Minute history does not cover creation; no outcome inferred.");
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${id}::uuid FOR UPDATE`;
    const current = await tx.journalEntry.findUniqueOrThrow({ where: { id }, include: { exits: true, events: true } });
    if (current.trackingMode === "automatic") return;
    if (current.openedAt || current.exits.length || !["planned", "expired"].includes(current.status))
      throw new Error("Entry has an execution or was cancelled; repair skipped.");
    await tx.journalEntry.update({ where: { id }, data: {
      status: "planned", trackingMode: "automatic", resultBasis: "estimated", checkedAt: current.createdAt,
      quantity: plan.conditionalEntry!.sizing.baseUnits,
      targetAllocations: plan.targets.map((_, i) => i === plan.targets.length - 1 ? 100 - Math.floor(100 / plan.targets.length) * i : Math.floor(100 / plan.targets.length)),
      events: { create: { key: "simulation-repair", kind: "edited", occurredAt: new Date(), reviewStatus: "not_needed",
        evidence: { message: "Observation-only plan corrected to an automatic simulation. Earlier coarse-candle ambiguity is superseded by one-minute replay; original plan and historical events are preserved." } } },
    } });
    const simulation = await tx.journalEntry.findUniqueOrThrow({ where: { id }, include: { events: true, exits: true } });
    await trackAutomatic(tx, simulation, fine, coarse);
  });
  const result = await db.journalEntry.findUniqueOrThrow({ where: { id }, include: { exits: true } });
  console.log(JSON.stringify({ symbol: result.symbol, status: result.status, openedAt: result.openedAt, entryPrice: result.entryPrice, quantity: result.quantity, exits: result.exits.length, monitoringStatus: result.monitoringStatus }));
}
void main().finally(async () => { await db.$disconnect(); await redis.beforeApplicationShutdown(); });
