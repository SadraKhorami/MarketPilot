import { z } from "zod";

const price = z.number().positive().finite().max(1e12);
const time = z.string().datetime({ offset: true });
export const ManualTradeSchema = z
  .object({
    symbol: z.string().trim().min(1).max(32),
    direction: z.enum(["BUY", "SELL"]),
    interval: z.enum(["1m", "5m", "15m", "1h", "6h", "1d"]),
    status: z.enum(["planned", "open", "closed", "cancelled", "expired"]),
    entry: price,
    stopLoss: price,
    targets: z.array(price).min(1).max(3),
    targetAllocations: z.array(z.number().positive().max(100)).min(1).max(3),
    quantity: price,
    fees: z.number().nonnegative().finite().max(1e12),
    startedAt: time,
    expiresAt: time,
    closedAt: time.nullable(),
    exitPrice: price.nullable(),
    exitReason: z.enum(["tp", "sl", "manual"]),
    trackingMode: z.enum(["automatic", "observed"]),
    entryTrigger: z.enum(["touch", "close_above", "close_below"]),
    notes: z.string().max(4000),
  })
  .strict()
  .superRefine((trade, ctx) => {
    const long = trade.direction === "BUY";
    if (!(long ? trade.stopLoss < trade.entry : trade.stopLoss > trade.entry))
      ctx.addIssue({ code: "custom", path: ["stopLoss"], message: "Stop loss must be on the loss side of entry." });
    if (
      !trade.targets.every((target, i) =>
        long ? target > (i ? trade.targets[i - 1] : trade.entry) : target < (i ? trade.targets[i - 1] : trade.entry),
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["targets"],
        message: "Targets must progress from entry in the profit direction.",
      });
    if (
      trade.targetAllocations.length !== trade.targets.length ||
      Math.abs(trade.targetAllocations.reduce((sum, n) => sum + n, 0) - 100) > 0.001
    )
      ctx.addIssue({
        code: "custom",
        path: ["targetAllocations"],
        message: "Target exit percentages must total 100%.",
      });
    if (Date.parse(trade.expiresAt) <= Date.parse(trade.startedAt))
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "Plan validity must end after its start." });
    if (
      trade.status === "closed" &&
      (!trade.closedAt || !trade.exitPrice || Date.parse(trade.closedAt) < Date.parse(trade.startedAt))
    )
      ctx.addIssue({
        code: "custom",
        path: ["closedAt"],
        message: "A closed trade needs a valid exit price and time.",
      });
    if (trade.status !== "closed" && (trade.closedAt !== null || trade.exitPrice !== null))
      ctx.addIssue({ code: "custom", path: ["exitPrice"], message: "Exit details only belong to closed trades." });
  });
export type ManualTrade = z.infer<typeof ManualTradeSchema>;
export const JournalExitInputSchema = z
  .object({
    requestId: z.string().uuid(),
    reconcile: z.boolean().optional(),
    price,
    quantity: price,
    fees: z.number().nonnegative().finite().max(1e12),
    occurredAt: time,
    reason: z.enum(["tp", "sl", "manual"]),
  })
  .strict();
export interface JournalExitRecord {
  id: string;
  price: number;
  quantity: number;
  fees: number;
  reason: string;
  basis: "recorded" | "estimated";
  occurredAt: string;
}
export interface JournalAnalytics {
  quote: string;
  basis: string;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  net: number;
  fees: number;
  average: number | null;
  profitFactor: number | null;
  series: Array<{ day: string; net: number; cumulative: number }>;
}
