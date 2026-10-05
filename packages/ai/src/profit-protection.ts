import type { TradeSetup } from "./contracts";

export function profitProtectionLevel(plan: TradeSetup, entryPrice: number): number | null {
  const rule = plan.conditionalEntry;
  if (!rule?.profitProtection || !Number.isFinite(entryPrice) || entryPrice <= 0) return null;
  const buffer = Math.max(rule.atr * rule.profitProtection.atrMultiple, rule.economics?.costPerUnit ?? 0);
  const level = plan.direction === "BUY" ? entryPrice + buffer : entryPrice - buffer;
  const target = plan.targets[0];
  if (level <= 0 || (plan.direction === "BUY" ? level >= target : level <= target)) return null;
  return Number(level.toFixed(8));
}
