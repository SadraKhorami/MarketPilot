import { z } from "zod";

export const TradePreferencesSchema = z
  .object({
    capital: z.number().positive().max(1e12).nullable(),
    currency: z.enum(["USD", "EUR", "GBP"]),
    riskPercent: z.number().min(0.01).max(10),
    interval: z.enum(["1m", "5m", "15m", "1h", "6h", "1d"]),
    holding: z.enum(["scalp", "day", "swing", "hybrid"]),
    autoReview: z.boolean(),
  })
  .strict();
export const TradeContextSchema = TradePreferencesSchema.extend({ symbol: z.string().min(1).max(32) }).strict();
export type TradeContext = z.infer<typeof TradeContextSchema>;
export type TradePreferences = z.infer<typeof TradePreferencesSchema>;
export const defaultTradePreferences: TradePreferences = {
  capital: null,
  currency: "USD",
  riskPercent: 1,
  interval: "15m",
  holding: "day",
  autoReview: false,
};
export interface JournalEventRecord {
  id: string;
  kind: string;
  occurredAt: string;
  evidence: { message: string; price?: number; interval?: string; source?: string };
  review: string | null;
  reviewStatus: string;
  reviewStartedAt: string | null;
}
export interface JournalRecord {
  updatedAt: string;
  id: string;
  runId: string | null;
  source: "ai" | "manual" | "import";
  trackingMode: "automatic" | "observed";
  entryTrigger: "touch" | "close_above" | "close_below";
  resultBasis: "recorded" | "estimated";
  targetAllocations: number[];
  archivedAt: string | null;
  exits: import("./journal-trades").JournalExitRecord[];
  symbol: string;
  status: "planned" | "open" | "closed" | "cancelled" | "expired";
  plan: import("./contracts").TradeSetup;
  context: TradePreferences;
  analysis: Array<{ text: string; sourceIds: string[] }>;
  notes: string;
  entryPrice: number | null;
  exitPrice: number | null;
  quantity: number | null;
  fees: number;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  checkedAt: string | null;
  monitoringStatus: string | null;
  events: JournalEventRecord[];
}

export function permitsTradeSetup(input: string) {
  if (/^\s*(?:explain|define|cancel)\b|^\s*(?:توضیح|تعریف|لغو)/iu.test(input)) return false;
  if (
    /\b(?:do not|don[’']t|never|avoid)\b.{0,45}\b(?:trade|entry|buy|sell|targets)\b|(?:ستاپ|سناریو|انتری|ورود|تارگت).{0,20}(?:نمی.?خوام|نده|نساز|نکن)/iu.test(
      input,
    )
  )
    return false;
  return /\b(?:trade setup|trading scenario|entry|stop.?loss|take.?profit|buy|sell|tp|sl)\b|ستاپ|سناریو.{0,25}معامل|نقطه.{0,15}ورود|انتری|حد.?ضرر|حد.?سود|تارگت|بخر|بفروش|خرید.{0,25}فروش|(?:کی|کجا|چه.?وقت).{0,25}(?:خرید|فروش)|(?:خرید|فروش).{0,15}کنم|(?:^|[\s،؟?!])(?:بای|سل)(?=$|[\s،؟?!])/iu.test(
    input,
  );
}
