import { TradeSetupSchema, type ConditionalEntry } from "@marketpilot/ai";

// Journal coverage is never broker coverage. Missing or incompatible positions are counted, not valued at zero.
export function recordedJournalRisk(
  entries: Array<{
    plan: unknown;
    entryPrice: number | null;
    quantity: number | null;
    resultBasis: string;
    exits: Array<{ quantity: number; basis: string }>;
  }>,
  quote: string,
): NonNullable<ConditionalEntry["openRisk"]> {
  let amount = 0;
  let knownTrades = 0;
  let unknownTrades = 0;
  for (const entry of entries) {
    const plan = TradeSetupSchema.safeParse(entry.plan);
    if (
      !plan.success ||
      plan.data.quote !== quote ||
      entry.entryPrice === null ||
      entry.quantity === null ||
      entry.quantity <= 0
    ) {
      unknownTrades++;
      continue;
    }
    const remaining = entry.quantity - entry.exits.reduce((sum, exit) => sum + exit.quantity, 0);
    if (remaining <= 0 || !Number.isFinite(remaining)) {
      unknownTrades++;
      continue;
    }
    const distance =
      plan.data.direction === "BUY" ? entry.entryPrice - plan.data.stopLoss : plan.data.stopLoss - entry.entryPrice;
    const risk = Math.max(0, distance) * remaining;
    if (!Number.isFinite(risk)) {
      unknownTrades++;
      continue;
    }
    amount += risk;
    knownTrades++;
  }
  return {
    basis: "recorded_journal_only",
    quote,
    knownAmount: knownTrades ? amount : null,
    knownTrades,
    unknownTrades,
    brokerCoverage: "unavailable",
    checkedAt: new Date().toISOString(),
  };
}
