import {
  JournalExitInputSchema,
  ManualTradeSchema,
  TradeSetupSchema,
  defaultTradePreferences,
  type ManualTrade,
  type JournalAnalytics,
} from "@marketpilot/ai";
import { Prisma } from "@marketpilot/db";
import { normalizeInstrumentSymbol } from "@marketpilot/market-data";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { DatabaseService } from "../database.module";
import { hasEstimatedEntry } from "./journal-execution-basis";
import { journalEditVersion } from "./journal-edit-version";
import { estimatedExitFees } from "./simulation-costs";
import type { JournalQueryDto } from "./journal.dto";

export function journalWhere(userId: string, query: JournalQueryDto) {
  return {
    userId,
    archivedAt: query.archived === "true" ? { not: null } : null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.basis ? { resultBasis: query.basis } : {}),
    ...(query.symbol ? { symbol: query.symbol } : {}),
    ...(query.search ? { AND: [{ symbol: { contains: query.search, mode: "insensitive" as const } }] } : {}),
  };
}
export function netResult(entry: {
  entryPrice: number | null;
  exitPrice: number | null;
  quantity: number | null;
  fees: number;
  plan: unknown;
  exits: Array<{ price: number; quantity: number; fees: number }>;
}) {
  const plan = TradeSetupSchema.safeParse(entry.plan);
  if (!plan.success || entry.entryPrice === null || entry.quantity === null || entry.quantity <= 0) return null;
  const entryPrice = entry.entryPrice;
  const quantity = entry.quantity;
  const sign = plan.data.direction === "BUY" ? 1 : -1;
  if (entry.exits.length)
    return entry.exits.reduce(
      (sum, exit) => sum + (exit.price - entryPrice) * exit.quantity * sign - exit.fees,
      (-entry.fees * entry.exits.reduce((sum, exit) => sum + exit.quantity, 0)) / quantity,
    );
  return entry.exitPrice === null ? null : (entry.exitPrice - entry.entryPrice) * entry.quantity * sign - entry.fees;
}
export function duplicateTradeWhere(userId: string, trade: ManualTrade, key: string): Prisma.JournalEntryWhereInput {
  return {
    userId,
    OR: [
      { importKey: key },
      {
        symbol: trade.symbol,
        quantity: trade.quantity,
        OR: [{ createdAt: new Date(trade.startedAt) }, { openedAt: new Date(trade.startedAt) }],
        AND: [
          { plan: { path: ["entry"], equals: trade.entry } },
          { plan: { path: ["direction"], equals: trade.direction } },
        ],
      },
    ],
  };
}
@Injectable()
export class JournalTradesService {
  constructor(private readonly db: DatabaseService) {}
  parse(input: unknown) {
    const parsed = ManualTradeSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message ?? "Check trade details.");
    const trade = parsed.data;
    trade.symbol = normalizeInstrumentSymbol(trade.symbol);
    if (!/^[A-Z0-9]+-[A-Z0-9]+$/.test(trade.symbol))
      throw new BadRequestException("Select a market pair, for example BTC-USD.");
    if (
      (trade.status !== "planned" && Date.parse(trade.startedAt) > Date.now()) ||
      (trade.closedAt && Date.parse(trade.closedAt) > Date.now())
    )
      throw new BadRequestException("Recorded trade times cannot be in the future.");
    return trade;
  }
  async create(userId: string, input: unknown, requestId: string) {
    const trade = this.parse(input);
    if (!/^[a-f0-9-]{36}$/i.test(requestId)) throw new BadRequestException("A request identifier is required.");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
      return this.createIn(tx, userId, trade, "manual", requestId);
    });
  }
  async createIn(
    tx: Prisma.TransactionClient,
    userId: string,
    trade: ManualTrade,
    source: "manual" | "import",
    key: string,
  ) {
    const prior = await tx.journalEntry.findUnique({ where: { userId_importKey: { userId, importKey: key } } });
    if (prior) return prior;
    const plan = TradeSetupSchema.parse({
      symbol: trade.symbol,
      direction: trade.direction,
      interval: trade.interval,
      stage: trade.status === "planned" ? "waiting_pullback" : "confirmed",
      entry: trade.entry,
      stopLoss: trade.stopLoss,
      targets: trade.targets,
      observedPrice: trade.entry,
      observedAt: trade.startedAt,
      expiresAt: trade.expiresAt,
      quote: trade.symbol.split("-").at(-1),
      pipSize: null,
      sourceId: "manual-journal",
    });
    const executed = trade.status === "open" || trade.status === "closed";
    const entry = await tx.journalEntry.create({
      data: {
        userId,
        source,
        importKey: key,
        status: trade.status,
        trackingMode: trade.trackingMode,
        entryTrigger: trade.entryTrigger,
        resultBasis: "recorded",
        targetAllocations: trade.targetAllocations,
        plan,
        symbol: trade.symbol,
        context: { ...defaultTradePreferences, interval: trade.interval },
        analysis: [],
        notes: trade.notes,
        createdAt: new Date(trade.startedAt),
        entryPrice: executed ? trade.entry : null,
        quantity: trade.quantity,
        openedAt: executed ? new Date(trade.startedAt) : null,
        exitPrice: trade.exitPrice,
        closedAt: trade.closedAt ? new Date(trade.closedAt) : null,
        fees: trade.fees,
        checkedAt: new Date(trade.startedAt),
        events: {
          create: {
            key: "saved",
            kind: "saved",
            occurredAt: new Date(),
            evidence: {
              message: `${source === "import" ? "Imported" : "Manually recorded"} ${trade.status} trade. ${trade.trackingMode === "automatic" ? "Automatic level tracking produces estimates, not broker executions." : "Price events are tracked as observations."}`,
            },
            reviewStatus: "not_needed",
          },
        },
        ...(trade.status === "closed" && trade.exitPrice && trade.closedAt
          ? {
              exits: {
                create: {
                  key: "initial-exit",
                  price: trade.exitPrice,
                  quantity: trade.quantity,
                  fees: 0,
                  reason: trade.exitReason,
                  basis: "recorded",
                  occurredAt: new Date(trade.closedAt),
                },
              },
            }
          : {}),
      },
    });
    return entry;
  }
  async edit(userId: string, id: string, input: unknown) {
    const request = z
      .object({
        trade: z.unknown(),
        updatedAt: z.string().datetime({ offset: true }),
        editVersion: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      })
      .strict()
      .safeParse(input);
    if (!request.success) throw new BadRequestException("Trade details and current version are required.");
    const trade = this.parse(request.data.trade);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const current = await tx.journalEntry.findFirst({
        where: { id, userId },
        include: { exits: { orderBy: { occurredAt: "asc" } }, events: true },
      });
      if (!current) throw new NotFoundException("Trade not found.");
      if (
        request.data.editVersion
          ? journalEditVersion(current) !== request.data.editVersion
          : current.updatedAt.getTime() !== Date.parse(request.data.updatedAt)
      )
        throw new ConflictException(
          "Trade details changed while you were editing. Load the latest trade here before saving.",
        );
      const oldPlan = TradeSetupSchema.parse(current.plan);
      const exited = current.exits.reduce((sum, exit) => sum + exit.quantity, 0);
      if (
        current.exits.length &&
        (trade.status !== current.status ||
          (current.status !== "closed" && trade.quantity <= exited) ||
          (current.status === "closed" && current.exits.length > 1 && Math.abs(trade.quantity - exited) > 1e-8))
      )
        throw new ConflictException("Recorded exits must remain consistent with status and quantity.");
      if (current.exits.some((exit) => exit.occurredAt.getTime() < Date.parse(trade.startedAt)))
        throw new BadRequestException("Entry time must be before all recorded exits.");
      if (
        current.exits.length > 1 &&
        (trade.exitPrice !== current.exitPrice ||
          Date.parse(trade.closedAt ?? "") !== (current.closedAt?.getTime() ?? NaN)) &&
        trade.status === "closed"
      )
        throw new ConflictException(
          "Partial exits are preserved. The combined exit price and time cannot be overwritten.",
        );
      const executed = ["open", "closed"].includes(trade.status);
      const changedLevels =
        ((!oldPlan.conditionalEntry || !executed) && oldPlan.entry !== trade.entry) ||
        oldPlan.stopLoss !== trade.stopLoss ||
        JSON.stringify(oldPlan.targets) !== JSON.stringify(trade.targets) ||
        oldPlan.direction !== trade.direction ||
        current.symbol !== trade.symbol ||
        oldPlan.interval !== trade.interval;
      if (
        oldPlan.conditionalEntry &&
        (changedLevels ||
          oldPlan.expiresAt !== trade.expiresAt ||
          current.entryTrigger !== trade.entryTrigger ||
          current.trackingMode !== trade.trackingMode)
      )
        throw new ConflictException(
          "This confirmed AI plan is immutable. Request and confirm a new scenario to change entry rules, levels or validity. Record actual executions separately.",
        );
      if (current.exits.length && (current.symbol !== trade.symbol || oldPlan.direction !== trade.direction))
        throw new ConflictException("Market and side cannot change after an exit has been recorded.");
      if (current.exits.length && JSON.stringify(current.targetAllocations) !== JSON.stringify(trade.targetAllocations))
        throw new ConflictException("Recorded exits retain their original target allocations.");
      if (current.openedAt && !executed)
        throw new ConflictException(
          "An executed trade cannot become a waiting, cancelled or expired plan. Record its exit instead.",
        );
      if (
        oldPlan.conditionalEntry &&
        !current.openedAt &&
        executed &&
        (Date.parse(trade.startedAt) < current.createdAt.getTime() ||
          Date.parse(trade.startedAt) > Date.parse(oldPlan.expiresAt))
      )
        throw new BadRequestException("Actual entry must be recorded within the confirmed plan's entry window.");
      const actualEntryChanged =
        executed &&
        (current.entryPrice !== trade.entry ||
          current.quantity !== trade.quantity ||
          current.openedAt?.getTime() !== Date.parse(trade.startedAt));
      const actualExitChanged =
        trade.status === "closed" &&
        (current.exitPrice !== trade.exitPrice ||
          current.closedAt?.getTime() !== Date.parse(trade.closedAt ?? "") ||
          current.quantity !== trade.quantity);
      const estimatedResult =
        (hasEstimatedEntry(current.events) && !actualEntryChanged) ||
        current.exits.some((exit) => exit.basis === "estimated" && !(current.exits.length === 1 && actualExitChanged));
      if (trade.status === "closed") {
        const price = trade.exitPrice;
        const closedAt = trade.closedAt;
        if (price === null || closedAt === null) throw new BadRequestException("A closed trade requires exit details.");
        const values = { price, quantity: trade.quantity, occurredAt: new Date(closedAt), reason: trade.exitReason };
        if (!current.exits.length) {
          await tx.journalExit.create({
            data: { ...values, entryId: id, key: `edited-${randomUUID()}`, fees: 0, basis: "recorded" },
          });
        } else if (current.exits.length === 1) {
          await tx.journalExit.update({
            where: { id: current.exits[0].id },
            data: { ...values, basis: actualExitChanged ? "recorded" : current.exits[0].basis },
          });
        }
      }
      if (oldPlan.conditionalEntry?.economics && executed) {
        for (const exit of current.exits) {
          if (exit.basis !== "estimated" || (current.exits.length === 1 && actualExitChanged)) continue;
          await tx.journalExit.update({
            where: { id: exit.id },
            data: { fees: estimatedExitFees(oldPlan, trade.entry, trade.quantity, trade.fees, exit.quantity) },
          });
        }
      }
      return tx.journalEntry.update({
        where: { id },
        data: {
          symbol: trade.symbol,
          status: trade.status,
          notes: trade.notes,
          quantity: trade.quantity,
          fees: trade.fees,
          entryPrice: executed ? trade.entry : null,
          openedAt: executed ? new Date(trade.startedAt) : null,
          createdAt: current.source === "ai" ? current.createdAt : new Date(trade.startedAt),
          closedAt: trade.closedAt ? new Date(trade.closedAt) : null,
          exitPrice: trade.exitPrice,
          trackingMode:
            current.exits.some((exit) => exit.basis === "recorded") || actualExitChanged
              ? "observed"
              : trade.trackingMode,
          entryTrigger: trade.entryTrigger,
          targetAllocations: trade.targetAllocations,
          plan: oldPlan.conditionalEntry
            ? (current.plan ?? Prisma.JsonNull)
            : {
                ...oldPlan,
                symbol: trade.symbol,
                direction: trade.direction,
                interval: trade.interval,
                entry: trade.entry,
                stopLoss: trade.stopLoss,
                targets: trade.targets,
                quote: trade.symbol.split("-").at(-1) ?? "USD",
                expiresAt: trade.expiresAt,
              },
          ...(actualEntryChanged
            ? { checkedAt: new Date(trade.startedAt) }
            : changedLevels ||
                current.entryTrigger !== trade.entryTrigger ||
                current.trackingMode !== trade.trackingMode
              ? { checkedAt: new Date() }
              : {}),
          ...(executed
            ? {
                resultBasis: estimatedResult ? "estimated" : "recorded",
              }
            : {}),
          events: {
            create: {
              key: `edited-${randomUUID()}`,
              kind: "edited",
              occurredAt: new Date(),
              evidence: {
                message: "Trade details explicitly corrected by the user. Existing executions were preserved.",
                previousPlan: current.plan,
                confirmedPlan: {
                  ...oldPlan,
                  entry: trade.entry,
                  stopLoss: trade.stopLoss,
                  targets: trade.targets,
                  expiresAt: trade.expiresAt,
                },
                actualEntryConfirmed: actualEntryChanged,
                monitoringReset:
                  changedLevels ||
                  actualEntryChanged ||
                  current.entryTrigger !== trade.entryTrigger ||
                  current.trackingMode !== trade.trackingMode,
                previousStatus: current.status,
                confirmedStatus: trade.status,
              },
              reviewStatus: "not_needed",
            },
          },
        },
        include: { exits: true, events: true },
      });
    });
  }
  async correctExecution(userId: string, id: string, input: unknown) {
    const parsed = z
      .object({
        editVersion: z.string().regex(/^[a-f0-9]{64}$/),
        price: z.number().positive().finite().max(1e12),
        quantity: z.number().positive().finite().max(1e12),
        fees: z.number().nonnegative().finite().max(1e12),
        occurredAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .safeParse(input);
    if (!parsed.success) throw new BadRequestException("Check actual entry details and current trade version.");
    const data = parsed.data;
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const entry = await tx.journalEntry.findFirst({ where: { id, userId }, include: { exits: true } });
      if (!entry) throw new NotFoundException("Trade not found.");
      if (journalEditVersion(entry) !== data.editVersion)
        throw new ConflictException("Trade details changed. Load the latest trade before correcting its entry.");
      if (!["open", "closed"].includes(entry.status))
        throw new ConflictException("Record an actual entry before correcting it.");
      const plan = TradeSetupSchema.parse(entry.plan);
      const time = Date.parse(data.occurredAt);
      if (
        time > Date.now() ||
        (plan.conditionalEntry && (time < entry.createdAt.getTime() || time > Date.parse(plan.expiresAt))) ||
        entry.exits.some((exit) => exit.occurredAt.getTime() < time)
      )
        throw new BadRequestException("Entry time must precede all exits and respect the confirmed AI entry window.");
      if (entry.source === "ai" && entry.resultBasis === "estimated" && entry.quantity === null) {
        for (const exit of entry.exits) {
          const quantity = exit.quantity * data.quantity;
          await tx.journalExit.update({ where: { id: exit.id }, data: { quantity, fees: exit.fees * data.quantity } });
          exit.quantity = quantity;
          exit.fees *= data.quantity;
        }
      }
      const exited = entry.exits.reduce((sum, exit) => sum + exit.quantity, 0);
      if (entry.status === "closed" ? Math.abs(data.quantity - exited) > data.quantity * 1e-9 : data.quantity <= exited)
        throw new BadRequestException(
          "Position size must remain consistent with recorded exits. Reconcile an estimated closed result to replace its fills.",
        );
      if (plan.conditionalEntry?.economics) {
        for (const exit of entry.exits) {
          if (exit.basis !== "estimated") continue;
          await tx.journalExit.update({
            where: { id: exit.id },
            data: { fees: estimatedExitFees(plan, data.price, data.quantity, data.fees, exit.quantity) },
          });
        }
      }
      return tx.journalEntry.update({
        where: { id },
        data: {
          entryPrice: data.price,
          quantity: data.quantity,
          fees: data.fees,
          openedAt: new Date(time),
          checkedAt: new Date(time),
          trackingMode: entry.trackingMode,
          resultBasis:
            entry.trackingMode === "automatic" || entry.exits.some((exit) => exit.basis === "estimated")
              ? "estimated"
              : "recorded",
          events: {
            create: {
              key: `entry-corrected:${randomUUID()}`,
              kind: "edited",
              occurredAt: new Date(),
              evidence: {
                message:
                  "User confirmed corrected actual entry details. The original plan and existing exits were preserved.",
                actualEntryConfirmed: true,
                monitoringReset: true,
                previousEntry: {
                  price: entry.entryPrice,
                  quantity: entry.quantity,
                  fees: entry.fees,
                  occurredAt: entry.openedAt?.toISOString(),
                },
                actualEntry: data,
              },
              reviewStatus: "not_needed",
            },
          },
        },
      });
    });
  }
  async remove(userId: string, id: string, input: unknown) {
    const parsed = z
      .object({
        confirm: z.literal(true),
        updatedAt: z.string().datetime({ offset: true }),
        editVersion: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      })
      .strict()
      .safeParse(input);
    if (!parsed.success) throw new BadRequestException("Confirm deletion of this trade.");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const current = await tx.journalEntry.findFirst({ where: { id, userId }, include: { exits: true } });
      if (!current) throw new NotFoundException("Trade not found.");
      if (
        parsed.data.editVersion
          ? journalEditVersion(current) !== parsed.data.editVersion
          : current.updatedAt.getTime() !== Date.parse(parsed.data.updatedAt)
      )
        throw new ConflictException("This trade changed. Reload before deleting it.");
      await tx.journalEntry.delete({ where: { id } });
      return { deleted: true };
    });
  }
  importKey(trade: ManualTrade) {
    return createHash("sha256")
      .update(JSON.stringify([trade.symbol, trade.direction, trade.startedAt, trade.entry, trade.quantity]))
      .digest("hex");
  }
  async exit(userId: string, id: string, input: unknown) {
    const parsed = JournalExitInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues[0]?.message);
    const data = parsed.data;
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const entry = await tx.journalEntry.findFirst({
        where: { id, userId },
        include: { exits: true, events: { select: { key: true, evidence: true } } },
      });
      if (!entry) throw new NotFoundException("Trade not found.");
      if (entry.exits.some((exit) => exit.key === data.requestId)) return entry;
      if (data.reconcile) {
        if (entry.status !== "closed" || entry.resultBasis !== "estimated")
          throw new ConflictException("Only an estimated closed result can be reconciled.");
        const actual = data.actualEntry;
        if (!actual) throw new BadRequestException("Confirm actual entry details first.");
        const actualTime = Date.parse(actual.occurredAt);
        const recordedExits = entry.exits.filter((exit) => exit.basis === "recorded");
        const alreadyExited = recordedExits.reduce((sum, exit) => sum + exit.quantity, 0);
        if (
          actualTime > Date.now() ||
          actualTime > Date.parse(data.occurredAt) ||
          recordedExits.some((exit) => exit.occurredAt.getTime() < actualTime)
        )
          throw new BadRequestException("Actual entry must precede all recorded exits and cannot be in the future.");
        if (
          actual.quantity <= alreadyExited ||
          data.quantity > actual.quantity - alreadyExited + actual.quantity * 1e-9
        )
          throw new BadRequestException("Actual position size must cover recorded and new exits.");
        entry.entryPrice = actual.price;
        entry.quantity = actual.quantity;
        entry.openedAt = new Date(actual.occurredAt);
        entry.fees = actual.fees;
        await tx.journalExit.deleteMany({ where: { entryId: id, basis: "estimated" } });
        entry.exits = entry.exits.filter((exit) => exit.basis === "recorded");
        entry.status = "open";
        await tx.journalEntry.update({
          where: { id },
          data: {
            status: "open",
            entryPrice: entry.entryPrice,
            quantity: entry.quantity,
            openedAt: entry.openedAt,
            fees: entry.fees,
            exitPrice: null,
            closedAt: null,
            trackingMode: "observed",
            resultBasis: "recorded",
          },
        });
      }
      const referenceSimulation = entry.source === "ai" && entry.resultBasis === "estimated" && entry.quantity === null;
      if (referenceSimulation) {
        if (data.fees !== 0) throw new BadRequestException("Set a position amount before recording monetary fees.");
        entry.quantity = 1; // Reference units only; the stored quantity remains null.
      }
      if (entry.status !== "open" || !entry.quantity || entry.entryPrice === null)
        throw new ConflictException("Only open trades can record an exit.");
      const remaining = entry.quantity - entry.exits.reduce((sum, exit) => sum + exit.quantity, 0);
      if (data.quantity > remaining + entry.quantity * 1e-9)
        throw new BadRequestException("Exit quantity exceeds the remaining position.");
      if (
        Date.parse(data.occurredAt) > Date.now() ||
        Date.parse(data.occurredAt) < (entry.openedAt?.getTime() ?? entry.createdAt.getTime())
      )
        throw new BadRequestException("Exit time must follow entry and cannot be in the future.");
      const exit = await tx.journalExit.create({
        data: {
          entryId: id,
          key: data.requestId,
          price: data.price,
          quantity: Math.min(data.quantity, remaining),
          fees: referenceSimulation
            ? estimatedExitFees(
                TradeSetupSchema.parse(entry.plan),
                entry.entryPrice,
                1,
                0,
                Math.min(data.quantity, remaining),
              )
            : data.fees,
          occurredAt: new Date(data.occurredAt),
          reason: data.reason,
          basis: referenceSimulation ? "estimated" : "recorded",
        },
      });
      const exits = [...entry.exits, exit];
      const estimatedEntry = !data.reconcile && hasEstimatedEntry(entry.events);
      const closed = remaining - exit.quantity <= entry.quantity * 1e-9;
      await tx.journalEntry.update({
        where: { id },
        data: {
          ...(closed
            ? {
                status: "closed",
                closedAt: new Date(Math.max(...exits.map((e) => e.occurredAt.getTime()))),
                exitPrice: exits.reduce((sum, e) => sum + e.price * e.quantity, 0) / entry.quantity,
              }
            : {}),
          resultBasis:
            (!data.reconcile && entry.trackingMode === "automatic") ||
            estimatedEntry ||
            exits.some((e) => e.basis === "estimated")
              ? "estimated"
              : "recorded",
          trackingMode: data.reconcile ? "observed" : entry.trackingMode,
        },
      });
      await tx.journalEvent.create({
        data: {
          entryId: id,
          key: `exit:${data.requestId}`,
          kind: data.reason,
          occurredAt: exit.occurredAt,
          evidence: {
            message: `Recorded ${data.reason} exit: ${exit.quantity} units at ${exit.price}. Remaining simulation quantity continues automatic tracking.`,
            price: exit.price,
            ...(data.reconcile ? { actualEntryConfirmed: true, actualEntry: data.actualEntry } : {}),
          },
          reviewStatus: "pending",
        },
      });
      return { id, closed };
    });
  }
  async transition(userId: string, id: string, action: "cancelled" | "expired") {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const entry = await tx.journalEntry.findFirst({ where: { id, userId } });
      if (!entry || entry.status !== "planned")
        throw new ConflictException("Only waiting plans can be cancelled or expired.");
      await tx.journalEntry.update({ where: { id }, data: { status: action } });
      await tx.journalEvent.create({
        data: {
          entryId: id,
          key: `${action}:${randomUUID()}`,
          kind: action,
          occurredAt: new Date(),
          evidence: { message: `User marked the unexecuted plan ${action}.` },
          reviewStatus: "not_needed",
        },
      });
      return { id };
    });
  }
  async archive(userId: string, id: string, archived: boolean) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "JournalEntry" WHERE id = ${id}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const entry = await tx.journalEntry.findFirst({ where: { userId, id } });
      if (!entry) throw new NotFoundException("Trade not found.");
      if (archived && ["planned", "open"].includes(entry.status))
        throw new ConflictException("Only inactive trades can be archived.");
      await tx.journalEntry.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
      await tx.journalEvent.create({
        data: {
          entryId: id,
          key: `archive:${randomUUID()}`,
          kind: archived ? "archive" : "restore",
          occurredAt: new Date(),
          evidence: { message: archived ? "User archived this trade." : "User restored this trade to the journal." },
          reviewStatus: "not_needed",
        },
      });
      return { id, archived };
    });
  }
  async currencies(userId: string) {
    const rows = await this.db.$queryRaw<
      Array<{ quote: string }>
    >`SELECT DISTINCT plan->>'quote' AS quote FROM "JournalEntry" WHERE "userId" = ${userId}::uuid AND plan->>'quote' IS NOT NULL ORDER BY quote`;
    return rows.map((row) => row.quote);
  }
  async analytics(userId: string, query: JournalQueryDto): Promise<JournalAnalytics> {
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 86400_000);
    const to = query.to ? new Date(query.to) : new Date();
    if (from > to) throw new BadRequestException("Choose a valid date range.");
    const quote = query.quote ?? "USD";
    const entries = await this.db.journalEntry.findMany({
      where: {
        ...journalWhere(userId, query),
        plan: { path: ["quote"], equals: quote },
        resultBasis: query.basis ?? "estimated",
        status: { in: ["open", "closed"] },
      },
      include: { exits: { orderBy: { occurredAt: "asc" } } },
    });
    const days = new Map<string, number>();
    let fees = 0;
    let net = 0;
    let wins = 0;
    let losses = 0;
    let closedTrades = 0;
    let closedNet = 0;
    let grossWin = 0;
    let grossLoss = 0;
    for (const entry of entries) {
      const plan = TradeSetupSchema.safeParse(entry.plan);
      if (!plan.success || entry.entryPrice === null || !entry.quantity) continue;
      const sign = plan.data.direction === "BUY" ? 1 : -1;
      const fills = entry.exits.length
        ? entry.exits
        : entry.status === "closed" && entry.exitPrice !== null && entry.closedAt
          ? [{ price: entry.exitPrice, quantity: entry.quantity, fees: 0, occurredAt: entry.closedAt }]
          : [];
      for (const fill of fills) {
        if (fill.occurredAt < from || fill.occurredAt > to) continue;
        const allocatedEntryFee = (entry.fees * fill.quantity) / entry.quantity;
        const value = (fill.price - entry.entryPrice) * fill.quantity * sign - fill.fees - allocatedEntryFee;
        fees += fill.fees + allocatedEntryFee;
        net += value;
        const day = fill.occurredAt.toISOString().slice(0, 10);
        days.set(day, (days.get(day) ?? 0) + value);
      }
      if (entry.status === "closed" && entry.closedAt && entry.closedAt >= from && entry.closedAt <= to) {
        closedTrades++;
        const full = netResult(entry) ?? 0;
        closedNet += full;
        if (full > 0) {
          wins++;
          grossWin += full;
        } else if (full < 0) {
          losses++;
          grossLoss -= full;
        }
      }
    }
    let cumulative = 0;
    return {
      quote,
      basis: query.basis ?? "estimated",
      closedTrades,
      unsizedTrades: entries.filter((e) => e.quantity === null).length,
      openTrades: entries.filter((e) => e.status === "open").length,
      net,
      fees,
      wins,
      losses,
      winRate: closedTrades ? (wins / closedTrades) * 100 : null,
      average: closedTrades ? closedNet / closedTrades : null,
      profitFactor: grossLoss ? grossWin / grossLoss : null,
      series: [...days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, value]) => {
          cumulative += value;
          return { day, net: value, cumulative };
        }),
    };
  }
}
