import assert from "node:assert/strict";
import { test } from "node:test";
import { ConditionalEntrySchema, entryAlertApproach, entryConditionMet } from "../src/entry-policy";
import { JournalExitInputSchema } from "../src/journal-trades";
const time = "2026-10-04T10:00:00Z";
function plan(
  direction: "BUY" | "SELL",
  condition: "touch" | "candle_close" | "break_retest",
  scenario: "pullback" | "breakout" = "pullback",
) {
  return {
    entry: 100,
    direction,
    conditionalEntry: ConditionalEntrySchema.parse({
      version: 2,
      scenario,
      condition,
      trendInterval: "1h",
      timeframeMode: "auto",
      validityMode: "auto",
      validityCandles: 3,
      breakoutAt: time,
      proposedAt: time,
      rationale: "Fixture",
      validityReason: "Fixture",
      invalidation: { kind: "stop_before_entry", price: 90 },
      atr: 2,
      maxEntryDistance: 3,
      news: { status: "unavailable", latestPublishedAt: null, checkedAt: time, sourceIds: [], calendar: "unavailable" },
      executionData: { spread: "unavailable", fees: "unavailable", liquidity: "unavailable" },
      sizing: { capitalBasis: "user_supplied", riskAmount: null, baseUnits: null, reason: "Fixture" },
    }),
  };
}
for (const direction of ["BUY", "SELL"] as const) {
  test(`${direction} pullback cannot activate from a close without a retest`, () => {
    const candle = direction === "BUY" ? { low: 101, high: 104, close: 103 } : { low: 96, high: 99, close: 97 };
    assert.equal(entryConditionMet(plan(direction, "candle_close"), candle, true), false);
  });
  test(`${direction} pullback needs a prior break and the correct close after retest`, () => {
    const candle = direction === "BUY" ? { low: 99, high: 103, close: 102 } : { low: 97, high: 101, close: 98 };
    assert.equal(entryConditionMet(plan(direction, "candle_close"), candle, false), false);
    assert.equal(entryConditionMet(plan(direction, "candle_close"), candle, true), true);
    assert.equal(entryConditionMet(plan(direction, "candle_close"), { ...candle, close: 100 }, true), false);
  });
}
test("break-retest requires a later retest; a breakout close can activate independently", () => {
  const candle = { low: 101, high: 104, close: 103 };
  assert.equal(entryConditionMet(plan("BUY", "break_retest", "breakout"), candle, true), false);
  assert.equal(entryConditionMet(plan("BUY", "candle_close", "breakout"), candle), true);
});
test("alert approach depends on price location rather than the trade side", () => {
  assert.deepEqual(entryAlertApproach({ entry: 100, observedPrice: 105 }), { fromBelow: false, gap: 5 });
  assert.deepEqual(entryAlertApproach({ entry: 100, observedPrice: 95 }), { fromBelow: true, gap: 5 });
});
test("reconciling estimates requires actual entry details and normal exits cannot change entry", () => {
  const exit = {
    requestId: "00000000-0000-4000-8000-000000000001",
    price: 110,
    quantity: 1,
    fees: 0,
    occurredAt: time,
    reason: "tp",
  };
  const actualEntry = { price: 100, quantity: 1, fees: 0, occurredAt: time };
  assert.equal(JournalExitInputSchema.safeParse(exit).success, true);
  assert.equal(JournalExitInputSchema.safeParse({ ...exit, reconcile: true }).success, false);
  assert.equal(JournalExitInputSchema.safeParse({ ...exit, reconcile: true, actualEntry }).success, true);
  assert.equal(JournalExitInputSchema.safeParse({ ...exit, actualEntry }).success, false);
});
