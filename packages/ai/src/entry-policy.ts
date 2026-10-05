import { z } from "zod";
import { TradeEconomicsSchema } from "./trade-economics";

export * from "./trade-economics";

export const entryDurations = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "6h": 21_600_000,
  "1d": 86_400_000,
};
export const SetupStrictnessSchema = z.enum(["low", "balanced", "high"]);
export type SetupStrictness = z.infer<typeof SetupStrictnessSchema>;

// Balanced preserves the original policy. These are screening choices, not success probabilities.
export function setupScreeningRules(level: SetupStrictness = "balanced") {
  return {
    minimumCandles: level === "low" ? 30 : level === "high" ? 100 : 50,
    maxEntryDistanceAtr: level === "low" ? 2.5 : level === "high" ? 1 : 1.5,
    requireTrendAlignment: level !== "low",
  };
}

export const EntryPolicySchema = z
  .object({
    strictness: SetupStrictnessSchema.optional(),
    roundTripCostPercent: z.number().min(0).max(10).finite().nullable().optional(),
    minimumNetRewardRisk: z.number().min(0).max(5).finite().optional(),
    timeframeMode: z.enum(["auto", "manual"]),
    trendInterval: z.enum(["15m", "1h", "6h", "1d"]),
    validityMode: z.enum(["auto", "manual"]),
    validityCandles: z.number().int().min(1).max(12),
    scenario: z.enum(["auto", "breakout", "pullback"]),
    condition: z.enum(["auto", "touch", "candle_close", "break_retest"]),
  })
  .strict();
export type EntryPolicy = z.infer<typeof EntryPolicySchema>;
// Legacy preferences retain their manual timeframe and three-candle validity.
export const defaultEntryPolicy: EntryPolicy = {
  timeframeMode: "manual",
  trendInterval: "1h",
  validityMode: "auto",
  validityCandles: 3,
  scenario: "auto",
  condition: "auto",
};
export function resolveEntryPolicy(value: {
  interval: keyof typeof entryDurations;
  entryPolicy?: EntryPolicy;
}): EntryPolicy {
  const higher = { "1m": "15m", "5m": "1h", "15m": "1h", "1h": "6h", "6h": "1d", "1d": "1d" } as const;
  return value.entryPolicy ?? { ...defaultEntryPolicy, trendInterval: higher[value.interval] };
}
export function automaticEntryIntervals(holding: "scalp" | "day" | "swing" | "hybrid") {
  return holding === "scalp"
    ? (["1m", "5m"] as const)
    : holding === "swing"
      ? (["1h", "6h"] as const)
      : holding === "hybrid"
        ? (["5m", "15m", "1h", "6h"] as const)
        : (["5m", "15m", "1h"] as const);
}

export const ConditionalEntrySchema = z
  .object({
    version: z.literal(2),
    strictness: SetupStrictnessSchema.optional(),
    evidence: z
      .object({
        entryCandles: z.number().int().min(30),
        trendCandles: z.number().int().nonnegative(),
        entryAveragePeriod: z.union([z.literal(30), z.literal(50)]),
        trendAveragePeriod: z.union([z.literal(30), z.literal(50)]).nullable(),
        trendStatus: z.enum(["aligned", "conflicting", "unavailable"]),
        limitations: z
          .array(z.enum(["limited_entry_history", "limited_trend_history", "trend_conflict", "trend_unavailable"]))
          .max(4),
      })
      .strict()
      .optional(),
    scenario: z.enum(["breakout", "pullback"]),
    condition: z.enum(["touch", "candle_close", "break_retest"]),
    trendInterval: z.enum(["15m", "1h", "6h", "1d"]),
    timeframeMode: z.enum(["auto", "manual"]),
    validityMode: z.enum(["auto", "manual"]),
    validityCandles: z.number().int().min(1).max(12),
    // Absent on existing plans: their exact elapsed-duration deadline is preserved.
    validityBasis: z.enum(["elapsed_duration", "entry_candle_closes"]).optional(),
    candleOffsetMs: z.number().int().min(0).max(86_399_999).optional(),
    breakoutAt: z.string().datetime({ offset: true }).nullable(),
    proposedAt: z.string().datetime({ offset: true }),
    rationale: z.string().min(1).max(500),
    validityReason: z.string().min(1).max(400),
    invalidation: z.object({ kind: z.literal("stop_before_entry"), price: z.number().positive().finite() }).strict(),
    atr: z.number().positive().finite(),
    profitProtection: z
      .object({
        atrMultiple: z.number().positive().max(5),
        effectiveAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .optional(),
    maxEntryDistance: z.number().positive().finite(),
    news: z
      .object({
        status: z.enum(["available", "stale", "unavailable"]),
        latestPublishedAt: z.string().datetime({ offset: true }).nullable(),
        checkedAt: z.string().datetime({ offset: true }),
        sourceIds: z.array(z.string().max(100)).max(5),
        calendar: z.literal("unavailable"),
      })
      .strict(),
    executionData: z
      .object({
        spread: z.literal("unavailable"),
        fees: z.literal("unavailable"),
        liquidity: z.literal("unavailable"),
      })
      .strict(),
    economics: TradeEconomicsSchema.optional(),
    sizing: z
      .object({
        capitalBasis: z.literal("user_supplied"),
        riskAmount: z.number().positive().finite().nullable(),
        baseUnits: z.number().positive().finite().nullable(),
        reason: z.string().max(300),
      })
      .strict(),
    openRisk: z
      .object({
        basis: z.literal("recorded_journal_only"),
        quote: z.string().max(16),
        knownAmount: z.number().finite().nonnegative().nullable(),
        knownTrades: z.number().int().nonnegative(),
        unknownTrades: z.number().int().nonnegative(),
        brokerCoverage: z.literal("unavailable"),
        checkedAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .optional(),
  })
  .strict();
export type ConditionalEntry = z.infer<typeof ConditionalEntrySchema>;

export function entryDeadline(
  proposedAt: number,
  interval: keyof typeof entryDurations,
  count: number,
  basis: ConditionalEntry["validityBasis"] = "elapsed_duration",
  candleOffsetMs = 0,
) {
  const duration = entryDurations[interval];
  return (
    (basis === "entry_candle_closes"
      ? Math.floor((proposedAt - candleOffsetMs) / duration) * duration + candleOffsetMs
      : proposedAt) +
    count * duration
  );
}

export function conditionalEntryStage(rule: Pick<ConditionalEntry, "scenario" | "condition" | "breakoutAt">) {
  if (rule.condition === "touch") return "waiting_touch";
  if (rule.scenario === "pullback" || (rule.condition === "break_retest" && rule.breakoutAt)) return "waiting_retest";
  return rule.condition === "break_retest" ? "waiting_break" : "waiting_close";
}

// Operational prose is derived from the executable fields, never from model text.
export function describeEntryCondition(
  plan: {
    interval: keyof typeof entryDurations;
    direction: "BUY" | "SELL";
    conditionalEntry: Pick<ConditionalEntry, "scenario" | "condition">;
  },
  persian = false,
) {
  const { scenario, condition } = plan.conditionalEntry;
  const side = plan.direction === "BUY" ? "above" : "below";
  const faSide = plan.direction === "BUY" ? "بالای" : "پایینِ";
  if (condition === "touch")
    return persian ? "بازآزمایی سطح ورود پس از شکست مشاهده‌شده" : "Retest Entry after the observed break";
  if (scenario === "pullback")
    return persian
      ? `پس از شکست مشاهده‌شده، بازآزمایی ورود در کندلی بعدی و بسته‌شدن کندل ${plan.interval} ${faSide} سطح ورود`
      : `After the observed break, a later candle retests Entry and the ${plan.interval} candle closes ${side} Entry`;
  if (condition === "break_retest")
    return persian
      ? `بسته‌شدن کندل ${plan.interval} ${faSide} ورود، سپس بازآزمایی در کندلی بعدی که ${faSide} ورود بسته شود`
      : `A ${plan.interval} candle closes ${side} Entry, then a later candle retests Entry and closes ${side} it`;
  return persian
    ? `بسته‌شدن کندل ${plan.interval} ${faSide} سطح ورود`
    : `A ${plan.interval} candle closes ${side} Entry`;
}

export function entryConditionMet(
  plan: { entry: number; direction: "BUY" | "SELL"; conditionalEntry?: ConditionalEntry },
  candle: { low: number; high: number; close: number },
  breakoutSeen = false,
  legacyTrigger: string = "touch",
) {
  const condition = plan.conditionalEntry?.condition;
  const close = plan.direction === "BUY" ? candle.close > plan.entry : candle.close < plan.entry;
  const touch = candle.low <= plan.entry && candle.high >= plan.entry;
  if (plan.conditionalEntry?.scenario === "pullback") {
    // A close above/below Entry alone is not a pullback. The candle must
    // revisit Entry after a separately observed break before confirming.
    return breakoutSeen && touch && (condition === "touch" || close);
  }
  if (condition === "break_retest") return breakoutSeen && touch && close;
  if (condition === "candle_close") return close;
  if (condition === "touch") return touch;
  return legacyTrigger === "close_above"
    ? candle.close >= plan.entry
    : legacyTrigger === "close_below"
      ? candle.close <= plan.entry
      : touch;
}

// Alert direction follows price approaching Entry, independently of the trade side.
export function entryAlertApproach(plan: { entry: number; observedPrice: number }) {
  return { fromBelow: plan.observedPrice < plan.entry, gap: Math.abs(plan.entry - plan.observedPrice) };
}
