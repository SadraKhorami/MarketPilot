import assert from "node:assert/strict";
import { test } from "node:test";
import { assessTradeEconomics, profitProtectionLevel, TradeSetupSchema } from "../src/contracts";
import {
  ConditionalEntrySchema,
  conditionalEntryStage,
  defaultEntryPolicy,
  describeEntryCondition,
  EntryPolicySchema,
  entryAlertApproach,
  entryConditionMet,
  entryDeadline,
  setupScreeningRules,
} from "../src/entry-policy";
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
test("close deadlines count future boundaries; existing elapsed deadlines remain unchanged", () => {
  const proposedAt = Date.parse("2026-10-04T19:34:14.456Z");
  assert.equal(
    new Date(entryDeadline(proposedAt, "15m", 3, "entry_candle_closes")).toISOString(),
    "2026-10-04T20:15:00.000Z",
  );
  assert.equal(new Date(entryDeadline(proposedAt, "15m", 3)).toISOString(), "2026-10-04T20:19:14.456Z");
  assert.equal(entryDeadline(Date.parse(time), "15m", 3, "entry_candle_closes"), Date.parse(time) + 2700_000);
  const rule = {
    ...plan("BUY", "candle_close", "breakout").conditionalEntry,
    breakoutAt: null,
    proposedAt: new Date(proposedAt).toISOString(),
  };
  const setup = {
    symbol: "BTC-USD",
    interval: "15m",
    direction: "BUY",
    stage: "waiting_reclaim",
    entry: 100,
    stopLoss: 90,
    targets: [120],
    observedPrice: 99,
    observedAt: rule.proposedAt,
    contextInterval: "1h",
    quote: "USD",
    pipSize: null,
    sourceId: "fixture",
    conditionalEntry: rule,
    expiresAt: "2026-10-04T20:19:14.456Z",
  };
  assert.equal(TradeSetupSchema.safeParse(setup).success, true);
  assert.equal(
    TradeSetupSchema.safeParse({ ...setup, conditionalEntry: { ...rule, validityBasis: "entry_candle_closes" } })
      .success,
    false,
  );
  assert.equal(
    TradeSetupSchema.safeParse({
      ...setup,
      expiresAt: "2026-10-04T20:15:00.000Z",
      conditionalEntry: { ...rule, validityBasis: "entry_candle_closes" },
    }).success,
    true,
  );
});
test("stages and operational descriptions follow the saved condition", () => {
  assert.equal(
    conditionalEntryStage({ scenario: "breakout", condition: "candle_close", breakoutAt: null }),
    "waiting_close",
  );
  assert.equal(
    conditionalEntryStage({ scenario: "breakout", condition: "break_retest", breakoutAt: null }),
    "waiting_break",
  );
  assert.equal(
    conditionalEntryStage({ scenario: "pullback", condition: "candle_close", breakoutAt: time }),
    "waiting_retest",
  );
  assert.equal(conditionalEntryStage({ scenario: "pullback", condition: "touch", breakoutAt: time }), "waiting_touch");
  assert.match(
    describeEntryCondition({ ...plan("SELL", "candle_close", "breakout"), interval: "15m" }),
    /15m candle closes below Entry/,
  );
});
test("close validity follows the observed candle grid rather than assuming UTC-hour boundaries", () => {
  const proposedAt = Date.parse("2026-10-04T19:34:14.456Z");
  assert.equal(
    new Date(entryDeadline(proposedAt, "1h", 3, "entry_candle_closes", 1800_000)).toISOString(),
    "2026-10-04T22:30:00.000Z",
  );
  assert.equal(entryDeadline(proposedAt, "1h", 3, "elapsed_duration", 1800_000), proposedAt + 10800_000);
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

test("profit protection uses actual entry, covers supplied costs and preserves old plans", () => {
  for (const direction of ["BUY", "SELL"] as const) {
    const setup = TradeSetupSchema.parse({
      ...plan(direction, "touch"),
      conditionalEntry: {
        ...plan(direction, "touch").conditionalEntry,
        invalidation: { kind: "stop_before_entry", price: direction === "BUY" ? 90 : 110 },
      },
      symbol: "BTC-USD",
      interval: "15m",
      contextInterval: "1h",
      stage: "confirmed",
      stopLoss: direction === "BUY" ? 90 : 110,
      targets: direction === "BUY" ? [120, 130] : [80, 70],
      observedPrice: 100,
      observedAt: time,
      expiresAt: "2026-10-04T10:45:00Z",
      quote: "USD",
      pipSize: null,
      sourceId: "fixture",
    });
    const rule = setup.conditionalEntry;
    if (!rule) throw new Error("Missing fixture rule");
    assert.equal(profitProtectionLevel(setup, 101), null);
    rule.profitProtection = { atrMultiple: 0.25, effectiveAt: time };
    assert.equal(profitProtectionLevel(setup, 101), direction === "BUY" ? 101.5 : 100.5);
    const assessment = assessTradeEconomics(setup, 1);
    if (!assessment.accepted) throw new Error(assessment.reason);
    rule.economics = assessment.economics;
    assert.equal(profitProtectionLevel(setup, 101), direction === "BUY" ? 102 : 100);
    assert.equal(profitProtectionLevel(setup, direction === "BUY" ? 119.5 : 80.5), null);
  }
});

test("strictness is backward compatible and rejects unknown policy values", () => {
  assert.equal(EntryPolicySchema.parse(defaultEntryPolicy).strictness, undefined);
  assert.equal(EntryPolicySchema.safeParse({ ...defaultEntryPolicy, strictness: "always_accept" }).success, false);
  assert.deepEqual(setupScreeningRules(), setupScreeningRules("balanced"));
  assert.equal(
    EntryPolicySchema.parse({ ...defaultEntryPolicy, strictness: "low", minimumNetRewardRisk: 2 }).minimumNetRewardRisk,
    2,
  );
});

test("policy supports explicit zero and fractional reward thresholds without changing the default", () => {
  assert.equal(EntryPolicySchema.parse({ ...defaultEntryPolicy, minimumNetRewardRisk: 0 }).minimumNetRewardRisk, 0);
  assert.equal(EntryPolicySchema.parse({ ...defaultEntryPolicy, minimumNetRewardRisk: 0.5 }).minimumNetRewardRisk, 0.5);
  assert.equal(EntryPolicySchema.safeParse({ ...defaultEntryPolicy, minimumNetRewardRisk: -0.1 }).success, false);
  assert.equal(defaultEntryPolicy.minimumNetRewardRisk ?? 1.5, 1.5);
});
