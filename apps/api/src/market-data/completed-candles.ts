import { entryDurations } from "@marketpilot/ai";
import type { MarketSnapshot } from "./market-data.service";

// A cached forming candle cannot become final merely because the clock advances.
// Request start is conservative when a provider response crosses a candle boundary.
export function completedSnapshotCandles(snapshot: MarketSnapshot, evaluatedAt: number) {
  const cutoff = Math.min(
    evaluatedAt,
    Date.parse(snapshot.fetchedAt),
    Date.parse(snapshot.candlesObservedAt ?? snapshot.fetchedAt),
  );
  return snapshot.data.candles.filter(
    (candle) => Date.parse(candle.time) + entryDurations[snapshot.data.interval] <= cutoff,
  );
}
