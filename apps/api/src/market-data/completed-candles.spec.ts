import { completedSnapshotCandles } from "./completed-candles";
import type { MarketSnapshot } from "./market-data.service";

const start = Date.parse("2026-10-04T10:00:00Z");
const candle = { time: new Date(start).toISOString(), open: 100, low: 99, high: 101, close: 100, volume: 1 };
function snapshot(fetchedAt: number, candlesObservedAt = fetchedAt) {
  return {
    fetchedAt: new Date(fetchedAt).toISOString(),
    candlesObservedAt: new Date(candlesObservedAt).toISOString(),
    data: { interval: "1m", candles: [candle] },
  } as MarketSnapshot;
}
it("never promotes a cached forming candle just because the clock advances", () => {
  expect(completedSnapshotCandles(snapshot(start + 30_000), start + 120_000)).toEqual([]);
});
it("bounds finality by request start if a response crosses the minute boundary", () => {
  expect(completedSnapshotCandles(snapshot(start + 61_000, start + 59_000), start + 120_000)).toEqual([]);
});
it("includes a candle actually requested after its close, only after the evaluation time reaches its end", () => {
  expect(completedSnapshotCandles(snapshot(start + 61_000), start + 59_000)).toEqual([]);
  expect(completedSnapshotCandles(snapshot(start + 61_000), start + 120_000)).toEqual([candle]);
});
