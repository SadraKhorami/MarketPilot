import type { TradeSetup } from "@marketpilot/ai";

// The round-trip budget already includes entry costs. Allocate only its remainder
// to estimated exits; recorded entry fees are deducted separately by netResult.
export function estimatedExitFees(
  plan: TradeSetup,
  price: number,
  quantity: number,
  entryFees: number,
  exited: number,
) {
  const percent = plan.conditionalEntry?.economics?.roundTripCostPercent;
  if (percent === undefined) return 0; // Historical plans have no stored cost estimate.
  return Math.max(0, (price * percent) / 100 - entryFees / quantity) * exited;
}
