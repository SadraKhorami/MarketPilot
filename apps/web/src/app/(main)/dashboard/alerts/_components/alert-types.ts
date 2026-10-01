export const conditions = {
  PRICE_ABOVE: "Price rises above",
  PRICE_BELOW: "Price falls below",
  RSI_ABOVE: "RSI rises above",
  RSI_BELOW: "RSI falls below",
  PERCENT_CHANGE_ABOVE: "Candle change rises above",
  PERCENT_CHANGE_BELOW: "Candle change falls below",
} as const;
export type AlertRecord = {
  id: string;
  name: string;
  assetId: string;
  condition: keyof typeof conditions;
  threshold: string;
  enabled: boolean;
  interval: string;
  cooldownMinutes: number;
  createdAt: string;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
  lastObservationAt: string | null;
  lastValue: string | null;
  evaluationReason: string | null;
};
export type TriggerRecord = {
  assetId: string;
  id: string;
  condition: keyof typeof conditions;
  threshold: string;
  value: string;
  unit: string;
  source: string;
  providerSymbol: string;
  priceKind: string;
  interval: string;
  observationAt: string;
  triggeredAt: string;
  deliveryStatus: string;
  failureCode: string | null;
  deliveredAt: string | null;
};
export const numberLabel = (value: string | number) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 8 });
export const dateLabel = (value: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not yet";
function ruleUnit(condition: string, asset: string) {
  if (condition.startsWith("RSI_")) return "RSI";
  return condition.startsWith("PERCENT_") ? "% / candle" : asset.split("-")[1];
}
export const conditionLabel = (rule: Pick<AlertRecord, "condition" | "threshold" | "assetId">) =>
  `${conditions[rule.condition] ?? rule.condition} ${numberLabel(rule.threshold)} ${ruleUnit(rule.condition, rule.assetId)}`;
const reasons: Record<string, string> = {
  BASELINE: "Baseline set",
  OLDER_OBSERVATION_SKIPPED: "Older observation skipped",
  AWAITING_BASELINE: "Waiting for baseline",
  ARMED: "Ready for a crossing",
  TRIGGERED: "Crossing triggered",
  COOLDOWN: "Crossing during cooldown",
  CONDITION_MATCHED: "Condition still matched",
  STALE_SNAPSHOT: "Waiting for fresh data",
  STALE_QUOTE: "Waiting for a fresh quote",
  STALE_CANDLES: "Waiting for a completed candle",
  MISSING_OR_INVALID_METRIC: "Indicator unavailable",
  MISSING_CANDLES: "No completed candles",
  MISSING_CHANGE_BASELINE: "Consecutive candles unavailable",
  INVALID_RULE: "Rule needs updating",
  UNAVAILABLE: "Provider temporarily unavailable",
  RATE_LIMITED: "Provider busy",
  INVALID_OBSERVATION: "Observation could not be validated",
  INSTRUMENT_MISMATCH: "Observation did not match the market",
  UNSUPPORTED_SYMBOL: "Market unavailable",
  INVALID_SYMBOL: "Market needs updating",
  INVALID_RESPONSE: "Provider response unavailable",
  REFRESH_FAILED: "Refresh temporarily unavailable",
  INVALID_CANDLES: "Candle data unavailable",
  INVALID_PRICE_KIND: "Price observation unavailable",
};
export const reasonLabel = (reason: string | null) =>
  reason ? (reasons[reason] ?? "Evaluation unavailable") : "Waiting for first observation";
