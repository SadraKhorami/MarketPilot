export type HistoryRange = "day" | "week" | "month";
export interface OverviewPreferences {
  pulse: string[];
  historySymbol: string;
  historyRange: HistoryRange;
  newsAssets: string[];
  newsCategories: string[];
}
export const historyRanges = {
  day: { label: "Last 24 hours", interval: "15m", milliseconds: 24 * 60 * 60 * 1000 },
  week: { label: "Last 7 days", interval: "1h", milliseconds: 7 * 24 * 60 * 60 * 1000 },
  month: { label: "Last 30 days", interval: "6h", milliseconds: 30 * 24 * 60 * 60 * 1000 },
} as const;
export const defaultOverviewPreferences: OverviewPreferences = {
  pulse: ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD"],
  historySymbol: "BTC-USD",
  historyRange: "day",
  newsAssets: [],
  newsCategories: [],
};
const symbolsValid = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 12 &&
  value.every((symbol) => typeof symbol === "string" && /^[A-Z0-9.-]{1,40}$/.test(symbol)) &&
  new Set(value).size === value.length;
export function isOverviewPreferences(value: unknown): value is OverviewPreferences {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    symbolsValid(record.pulse) &&
    symbolsValid(record.newsAssets) &&
    typeof record.historySymbol === "string" &&
    /^[A-Z0-9.-]{1,40}$/.test(record.historySymbol) &&
    typeof record.historyRange === "string" &&
    Object.hasOwn(historyRanges, record.historyRange) &&
    Array.isArray(record.newsCategories) &&
    record.newsCategories.length <= 20 &&
    record.newsCategories.every(
      (category) => typeof category === "string" && category.length > 0 && category.length <= 100,
    )
  );
}
