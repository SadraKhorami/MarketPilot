import { z } from "zod";

export const TradeEconomicsSchema = z
  .object({
    costBasis: z.literal("user_estimate"),
    roundTripCostPercent: z.number().min(0).max(10).finite(),
    minimumNetRewardRisk: z.number().min(0).max(5).finite(),
    targetAllocations: z.array(z.number().positive().max(100)).min(1).max(3),
    costPerUnit: z.number().nonnegative().finite(),
    grossRewardRisk: z.number().positive().finite(),
    netRewardRisk: z.number().positive().finite(),
    netRewardPerUnit: z.number().positive().finite(),
    stopRiskPerUnit: z.number().positive().finite(),
  })
  .strict();

export function equalTargetAllocations(count: number) {
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? 100 - Math.floor(100 / count) * index : Math.floor(100 / count),
  );
}

export function assessTradeEconomics(
  plan: { entry: number; stopLoss: number; targets: number[]; direction: "BUY" | "SELL" },
  roundTripCostPercent: number | null | undefined,
  minimumNetRewardRisk = 1.5,
  targetAllocations = equalTargetAllocations(plan.targets.length),
) {
  const reject = (reason: string) => ({ accepted: false as const, reason });
  if (roundTripCostPercent === null || roundTripCostPercent === undefined)
    return reject(
      "Enter a round-trip cost estimate in trading preferences before requesting a plan; unknown costs cannot be treated as zero.",
    );
  if (
    !Number.isFinite(roundTripCostPercent) ||
    roundTripCostPercent < 0 ||
    roundTripCostPercent > 10 ||
    !Number.isFinite(minimumNetRewardRisk) ||
    minimumNetRewardRisk < 0 ||
    minimumNetRewardRisk > 5
  )
    return reject("Choose valid cost and minimum net reward/risk settings.");
  const risk = Math.abs(plan.entry - plan.stopLoss);
  const sign = plan.direction === "BUY" ? 1 : -1;
  if (
    !Number.isFinite(plan.entry) ||
    plan.entry <= 0 ||
    !Number.isFinite(plan.stopLoss) ||
    plan.stopLoss <= 0 ||
    !Number.isFinite(risk) ||
    risk <= 0 ||
    (plan.entry - plan.stopLoss) * sign <= 0 ||
    !plan.targets.length ||
    plan.targets.length > 3 ||
    plan.targets.some(
      (target, index) =>
        !Number.isFinite(target) || target <= 0 || (index > 0 && (target - plan.targets[index - 1]) * sign <= 0),
    ) ||
    targetAllocations.length !== plan.targets.length ||
    targetAllocations.some((value) => !Number.isFinite(value) || value <= 0) ||
    Math.abs(targetAllocations.reduce((sum, value) => sum + value, 0) - 100) > 1e-6
  )
    return reject("Trade prices or exit allocations are invalid.");
  const costPerUnit = (plan.entry * roundTripCostPercent) / 100;
  const rewards = plan.targets.map((target) => (target - plan.entry) * sign);
  if (rewards.some((reward) => !Number.isFinite(reward) || reward <= costPerUnit))
    return reject(
      "A target offers no positive profit after the supplied round-trip costs. Wait for a more suitable setup.",
    );
  const reward = rewards.reduce((sum, value, index) => sum + (value * targetAllocations[index]) / 100, 0);
  const stopRiskPerUnit = risk + costPerUnit;
  const netRewardPerUnit = reward - costPerUnit;
  const netRewardRisk = netRewardPerUnit / stopRiskPerUnit;
  if (minimumNetRewardRisk > 0 && netRewardRisk + 1e-9 < minimumNetRewardRisk)
    return reject(
      `No suitable setup: weighted net reward/risk is ${netRewardRisk.toFixed(2)}R, below your ${minimumNetRewardRisk.toFixed(2)}R minimum after estimated costs.`,
    );
  return {
    accepted: true as const,
    economics: {
      costBasis: "user_estimate" as const,
      roundTripCostPercent,
      minimumNetRewardRisk,
      targetAllocations,
      costPerUnit,
      grossRewardRisk: reward / risk,
      netRewardRisk,
      netRewardPerUnit,
      stopRiskPerUnit,
    },
  };
}

export function sizeUnleveragedTrade(
  entry: number,
  stopRiskPerUnit: number,
  costPerUnit: number,
  capital: number,
  riskPercent: number,
) {
  const riskAmount = (capital * riskPercent) / 100;
  return { riskAmount, baseUnits: Math.min(riskAmount / stopRiskPerUnit, capital / (entry + costPerUnit)) };
}

// JSON/database float round trips may change a derived value by a few ULPs.
// This tolerance is for recomputed values, never for user policy thresholds.
export function sameComputedNumber(actual: number, expected: number) {
  return (
    Number.isFinite(actual) &&
    Number.isFinite(expected) &&
    Math.abs(actual - expected) <= 8 * Number.EPSILON * Math.max(1, Math.abs(actual), Math.abs(expected))
  );
}

export function matchesTradeEconomics(
  actual: z.infer<typeof TradeEconomicsSchema> | undefined,
  expected: z.infer<typeof TradeEconomicsSchema>,
) {
  if (
    !actual ||
    actual.costBasis !== expected.costBasis ||
    actual.roundTripCostPercent !== expected.roundTripCostPercent ||
    actual.minimumNetRewardRisk !== expected.minimumNetRewardRisk ||
    actual.targetAllocations.length !== expected.targetAllocations.length ||
    actual.targetAllocations.some((allocation, index) => allocation !== expected.targetAllocations[index])
  )
    return false;
  const computed = ["costPerUnit", "grossRewardRisk", "netRewardRisk", "netRewardPerUnit", "stopRiskPerUnit"] as const;
  return computed.every((field) => sameComputedNumber(actual[field], expected[field]));
}
