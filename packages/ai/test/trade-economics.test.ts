import { matchesTradeEconomics } from "../src/trade-economics";
import assert from "node:assert/strict";
import { test } from "node:test";
import { assessTradeEconomics, equalTargetAllocations, sizeUnleveragedTrade } from "../src/trade-economics";
const plan = { entry: 100, stopLoss: 90, targets: [120, 125], direction: "BUY" as const };
test("unknown costs do not pass as zero, but an explicit zero is supported", () => {
  assert.equal(assessTradeEconomics(plan, null).accepted, false);
  assert.equal(assessTradeEconomics(plan, 0).accepted, true);
});
test("the actual SOL setup fails even before fees", () => {
  const result = assessTradeEconomics(
    { entry: 121.3, stopLoss: 120.75, targets: [121.72, 121.77], direction: "BUY" },
    0,
  );
  assert.equal(result.accepted, false);
});
test("round-trip costs reduce reward and increase stop risk", () => {
  const result = assessTradeEconomics(plan, 1);
  assert.equal(result.accepted, true);
  if (!result.accepted) return;
  assert.equal(result.economics.costPerUnit, 1);
  assert.equal(result.economics.netRewardPerUnit, 21.5);
  assert.equal(result.economics.stopRiskPerUnit, 11);
  assert.equal(result.economics.netRewardRisk, 21.5 / 11);
});
test("costs consuming a target are rejected even if a distant target is attractive", () => {
  assert.equal(assessTradeEconomics({ ...plan, targets: [100.5, 150] }, 1).accepted, false);
});
test("weights use the whole position rather than only the farthest target", () => {
  assert.equal(assessTradeEconomics({ ...plan, targets: [105, 150] }, 0, 1.5, [90, 10]).accepted, false);
  assert.equal(assessTradeEconomics({ ...plan, targets: [105, 150] }, 0, 1.5, [50, 50]).accepted, true);
});
test("short positions use the correct direction and allocation totals", () => {
  assert.equal(
    assessTradeEconomics({ entry: 100, stopLoss: 110, targets: [80, 75], direction: "SELL" }, 1).accepted,
    true,
  );
  assert.equal(assessTradeEconomics(plan, 0, 1.5, [40, 40]).accepted, false);
  assert.deepEqual(equalTargetAllocations(3), [33, 33, 34]);
});
test("capital caps include costs and risk is a ceiling rather than forced spending", () => {
  const size = sizeUnleveragedTrade(121.3, 0.55, 0, 100, 1);
  assert.ok(size.baseUnits * 121.3 <= 100 + 1e-9);
  assert.ok(size.baseUnits * 0.55 < size.riskAmount);
  const withCosts = sizeUnleveragedTrade(100, 2, 1, 100, 10);
  assert.equal(withCosts.baseUnits, 100 / 101);
});
test("rejects nonpositive, duplicate, unordered and excessive targets at the economics boundary", () => {
  for (const targets of [
    [120, 120],
    [125, 120],
    [120, 125, 130, 140],
  ])
    assert.equal(assessTradeEconomics({ ...plan, targets }, 0).accepted, false);
  assert.equal(assessTradeEconomics({ entry: 100, stopLoss: 110, direction: "SELL", targets: [0] }, 0).accepted, false);
});

test("saving accepts database float round-trip differences but rejects modified economics", () => {
  const quality = assessTradeEconomics(
    { entry: 2704.4, stopLoss: 2695, targets: [2706.82, 2707.1, 2768.69], direction: "BUY" },
    0,
  );
  assert.ok(quality.accepted);
  if (!quality.accepted) return;
  const stored = { ...quality.economics, grossRewardRisk: 2.505127659574439, netRewardRisk: 2.505127659574439 };
  assert.equal(matchesTradeEconomics(stored, quality.economics), true);
  assert.equal(
    matchesTradeEconomics({ ...stored, netRewardRisk: stored.netRewardRisk + 0.001 }, quality.economics),
    false,
  );
  assert.equal(matchesTradeEconomics({ ...stored, roundTripCostPercent: 0.0001 }, quality.economics), false);
  assert.equal(matchesTradeEconomics({ ...stored, minimumNetRewardRisk: 1.6 }, quality.economics), false);
  assert.equal(matchesTradeEconomics({ ...stored, targetAllocations: [34, 33, 33] }, quality.economics), false);
  assert.equal(matchesTradeEconomics(undefined, quality.economics), false);
});
