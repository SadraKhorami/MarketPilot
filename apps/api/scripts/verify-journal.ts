import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { defaultTradePreferences, ConditionalEntrySchema, TradeSetupSchema, type ManualTrade } from "@marketpilot/ai";
import { DatabaseService } from "../src/database.module";
import { JournalTradesService, netResult } from "../src/journal/journal-trades.service";
import { JournalService } from "../src/journal/journal.service";
import { journalEditVersion } from "../src/journal/journal-edit-version";

config({ path: "../../.env", quiet: true });
if (
  process.env.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(process.env.DATABASE_URL ?? "").hostname)
)
  throw new Error("Verification requires a local development database.");
const db = new DatabaseService();
const rollback = new Error("verification rollback");
const now = Date.now();
const startedAt = new Date(now - 3600_000).toISOString();
const occurredAt = new Date(now - 1800_000).toISOString();
const trade: ManualTrade = {
  symbol: "BTC-USD",
  direction: "BUY",
  interval: "15m",
  status: "open",
  entry: 100,
  stopLoss: 90,
  targets: [110],
  targetAllocations: [100],
  quantity: 2,
  fees: 10,
  startedAt,
  expiresAt: new Date(now + 3600_000).toISOString(),
  closedAt: null,
  exitPrice: null,
  exitReason: "manual",
  trackingMode: "observed",
  entryTrigger: "touch",
  notes: "Verification only",
};
async function main() {
  try {
    await db.$transaction(
      async (tx) => {
        // Service transactions share the outer transaction; no fixture can commit.
        const scoped = new Proxy(db, {
          get(target, property) {
            if (property === "$transaction") return (action: (client: typeof tx) => Promise<unknown>) => action(tx);
            const value = Reflect.get(tx, property) ?? Reflect.get(target, property);
            return typeof value === "function" ? value.bind(tx) : value;
          },
        });
        const trades = new JournalTradesService(scoped);
        const journal = new JournalService(
          scoped,
          undefined as never,
          undefined as never,
          undefined as never,
          null,
          undefined as never,
        );
        const user = await tx.user.create({
          data: {
            email: `journal-verification-${randomUUID()}@example.invalid`,
            passwordHash: "test-only-not-a-login-hash",
            name: "Transactional verification",
          },
        });
        const key = randomUUID();
        const created = await trades.create(user.id, trade, key);
        assert.equal((await trades.create(user.id, trade, key)).id, created.id);
        const exitId = randomUUID();
        await trades.exit(user.id, created.id, {
          requestId: exitId,
          price: 120,
          quantity: 1,
          fees: 3,
          occurredAt,
          reason: "tp",
        });
        await trades.exit(user.id, created.id, {
          requestId: exitId,
          price: 120,
          quantity: 1,
          fees: 3,
          occurredAt,
          reason: "tp",
        });
        let record = await tx.journalEntry.findUniqueOrThrow({ where: { id: created.id }, include: { exits: true } });
        assert.equal(record.exits.length, 1);
        assert.equal(record.status, "open");
        assert.equal(netResult(record), 12);
        const version = journalEditVersion(record);
        await tx.journalEntry.update({
          where: { id: record.id },
          data: { checkedAt: new Date(), monitoringStatus: "Routine observation" },
        });
        await trades.edit(user.id, record.id, {
          trade: { ...trade, notes: "Edited with partial exit preserved" },
          updatedAt: record.updatedAt.toISOString(),
          editVersion: version,
        });
        record = await tx.journalEntry.findUniqueOrThrow({ where: { id: record.id }, include: { exits: true } });
        assert.equal(record.exits[0].price, 120);
        await assert.rejects(
          trades.exit(user.id, record.id, {
            requestId: randomUUID(),
            price: 110,
            quantity: 2,
            fees: 0,
            occurredAt,
            reason: "manual",
          }),
          /remaining position/,
        );
        await trades.correctExecution(user.id, record.id, {
          editVersion: journalEditVersion(record),
          price: 101,
          quantity: 2,
          fees: 10,
          occurredAt: startedAt,
        });
        await trades.exit(user.id, record.id, {
          requestId: randomUUID(),
          price: 110,
          quantity: 1,
          fees: 2,
          occurredAt,
          reason: "manual",
        });
        record = await tx.journalEntry.findUniqueOrThrow({ where: { id: record.id }, include: { exits: true } });
        assert.equal(record.status, "closed");
        assert.equal(netResult(record), 13);
        const analytics = await trades.analytics(user.id, {
          page: 1,
          pageSize: 20,
          from: startedAt,
          to: new Date().toISOString(),
          quote: "USD",
          basis: "recorded",
        });
        assert.equal(analytics.net, 13);
        assert.equal(analytics.fees, 15);
        assert.equal(analytics.closedTrades, 1);
        await tx.journalEntry.update({ where: { id: record.id }, data: { checkedAt: new Date() } });
        await trades.remove(user.id, record.id, {
          confirm: true,
          editVersion: journalEditVersion(record),
          updatedAt: record.updatedAt.toISOString(),
        });
        assert.equal(await tx.journalEntry.findUnique({ where: { id: record.id } }), null);
        console.log(
          "PASS manual: idempotency, partial exit, fee allocation, concurrent monitor update, correction, analytics and deletion",
        );

        const estimated = await trades.create(
          user.id,
          { ...trade, status: "closed", exitPrice: 110, closedAt: occurredAt },
          randomUUID(),
        );
        await tx.journalEntry.update({
          where: { id: estimated.id },
          data: {
            resultBasis: "estimated",
            events: {
              create: {
                key: "auto:entry",
                kind: "entry",
                occurredAt: new Date(startedAt),
                evidence: { message: "Test-only estimated entry" },
              },
            },
          },
        });
        await tx.journalExit.updateMany({ where: { entryId: estimated.id }, data: { basis: "estimated" } });
        const estimatedRecord = await tx.journalEntry.findUniqueOrThrow({
          where: { id: estimated.id },
          include: { exits: true },
        });
        await trades.edit(user.id, estimated.id, {
          trade: {
            ...trade,
            status: "closed",
            exitPrice: 110,
            closedAt: occurredAt,
            notes: "Notes do not confirm execution",
          },
          updatedAt: estimatedRecord.updatedAt.toISOString(),
          editVersion: journalEditVersion(estimatedRecord),
        });
        assert.equal(
          (await tx.journalEntry.findUniqueOrThrow({ where: { id: estimated.id } })).resultBasis,
          "estimated",
        );
        await trades.exit(user.id, estimated.id, {
          requestId: randomUUID(),
          reconcile: true,
          actualEntry: { price: 100, quantity: 2, fees: 10, occurredAt: startedAt },
          price: 120,
          quantity: 1,
          fees: 3,
          occurredAt,
          reason: "tp",
        });
        const reconciled = await tx.journalEntry.findUniqueOrThrow({
          where: { id: estimated.id },
          include: { exits: true, events: true },
        });
        assert.equal(reconciled.status, "open");
        assert.equal(reconciled.resultBasis, "recorded");
        assert.equal(reconciled.exits.length, 1);
        assert.ok(reconciled.events.some((event) => event.key === "auto:entry"));
        assert.equal(netResult(reconciled), 12);
        console.log(
          "PASS estimates: note-only edits preserve basis; explicit reconciliation replaces fills and retains timeline",
        );

        const conditional = ConditionalEntrySchema.parse({
          version: 2,
          scenario: "pullback",
          condition: "candle_close",
          trendInterval: "1h",
          timeframeMode: "auto",
          validityMode: "auto",
          validityCandles: 3,
          breakoutAt: startedAt,
          proposedAt: startedAt,
          rationale: "Test fixture",
          validityReason: "Test fixture",
          invalidation: { kind: "stop_before_entry", price: 90 },
          atr: 2,
          maxEntryDistance: 3,
          news: {
            status: "unavailable",
            latestPublishedAt: null,
            checkedAt: startedAt,
            sourceIds: [],
            calendar: "unavailable",
          },
          executionData: { spread: "unavailable", fees: "unavailable", liquidity: "unavailable" },
          sizing: { capitalBasis: "user_supplied", riskAmount: null, baseUnits: null, reason: "Test fixture" },
        });
        const ai = await tx.journalEntry.create({
          data: {
            userId: user.id,
            source: "ai",
            symbol: trade.symbol,
            plan: TradeSetupSchema.parse({
              ...TradeSetupSchema.parse(created.plan),
              contextInterval: "1h",
              conditionalEntry: conditional,
              expiresAt: new Date(now - 900_000).toISOString(),
            }),
            context: defaultTradePreferences,
            analysis: [],
            status: "planned",
            trackingMode: "observed",
            entryTrigger: "close_above",
            targetAllocations: [100],
            createdAt: new Date(startedAt),
          },
        });
        await journal.expirePlans(user.id);
        assert.equal((await tx.journalEntry.findUniqueOrThrow({ where: { id: ai.id } })).status, "expired");
        await journal.update(user.id, ai.id, {
          status: "open",
          entryPrice: 102,
          quantity: 2,
          fees: 10,
          openedAt: new Date(now - 3000_000).toISOString(),
        });
        await journal.expirePlans(user.id);
        let aiRecord = await tx.journalEntry.findUniqueOrThrow({ where: { id: ai.id }, include: { exits: true } });
        assert.equal(aiRecord.status, "open");
        await trades.correctExecution(user.id, ai.id, {
          editVersion: journalEditVersion(aiRecord),
          price: 103,
          quantity: 2,
          fees: 10,
          occurredAt: new Date(now - 3000_000).toISOString(),
        });
        aiRecord = await tx.journalEntry.findUniqueOrThrow({ where: { id: ai.id }, include: { exits: true } });
        assert.deepEqual(aiRecord.plan, ai.plan);
        assert.equal(aiRecord.entryPrice, 103);
        console.log(
          "PASS AI: expired waiting plan accepts an earlier execution; open position does not expire; execution correction preserves confirmed plan",
        );
        const simulation = await tx.journalEntry.create({ data: {
          userId: user.id, source: "ai", symbol: trade.symbol, plan: TradeSetupSchema.parse(ai.plan),
          context: defaultTradePreferences, analysis: [], status: "open", trackingMode: "automatic",
          resultBasis: "estimated", targetAllocations: [100], quantity: null, entryPrice: 100,
          openedAt: new Date(startedAt), createdAt: new Date(startedAt),
        } });
        await journal.expirePlans(user.id);
        assert.equal((await tx.journalEntry.findUniqueOrThrow({ where: { id: simulation.id } })).status, "open");
        await trades.exit(user.id, simulation.id, { requestId: randomUUID(), price: 110, quantity: 0.5, fees: 0, occurredAt, reason: "tp" });
        let simulated = await tx.journalEntry.findUniqueOrThrow({ where: { id: simulation.id }, include: { exits: true } });
        assert.equal(simulated.quantity, null);
        assert.equal(simulated.trackingMode, "automatic");
        assert.equal(simulated.resultBasis, "estimated");
        assert.equal(netResult(simulated), null);
        const unsized = await trades.analytics(user.id, { page: 1, pageSize: 50, basis: "estimated", quote: "USD", from: startedAt, to: new Date().toISOString() });
        assert.equal(unsized.unsizedTrades, 1);
        await trades.correctExecution(user.id, simulation.id, { editVersion: journalEditVersion(simulated), price: 100, quantity: 2, fees: 0, occurredAt: startedAt });
        simulated = await tx.journalEntry.findUniqueOrThrow({ where: { id: simulation.id }, include: { exits: true } });
        assert.equal(simulated.exits[0].quantity, 1);
        assert.equal(simulated.quantity, 2);
        assert.equal(simulated.trackingMode, "automatic");
        assert.equal(netResult(simulated), 10);
        await trades.exit(user.id, simulation.id, { requestId: randomUUID(), price: 90, quantity: 1, fees: 0, occurredAt: new Date(now - 60_000).toISOString(), reason: "sl" });
        simulated = await tx.journalEntry.findUniqueOrThrow({ where: { id: simulation.id }, include: { exits: true } });
        assert.equal(simulated.status, "closed");
        assert.equal(simulated.resultBasis, "estimated");
        assert.equal(netResult(simulated), 0);
        console.log("PASS simulations: open positions survive expiry; reference fills exclude monetary P&L; sizing rescales partial exits; manual closes preserve simulation basis");
        throw rollback;
      },
      { timeout: 30_000 },
    );
  } catch (failure) {
    if (failure !== rollback) throw failure;
  } finally {
    await db.$disconnect();
  }
  console.log("PASS all verification fixtures rolled back");
}
main().catch((failure: unknown) => {
  console.error("Journal verification failed; fixtures rolled back.");
  if (failure instanceof assert.AssertionError) console.error(failure.message);
  else if (failure instanceof Error)
    console.error(
      failure.name,
      failure.stack
        ?.split("\n")
        .filter((line) => line.trim().startsWith("at "))
        .join("\n"),
    );
  process.exitCode = 1;
});
