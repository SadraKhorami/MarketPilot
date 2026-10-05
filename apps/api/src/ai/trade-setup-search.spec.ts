import { defaultTradePreferences, resolveEntryPolicy, toolSchemas } from "@marketpilot/ai";
import { searchTradeSetups, tradeSetupCandidates } from "./trade-setup-search";

const request = toolSchemas.getTradeSetup.parse({
  symbol: "ETH-USD",
  interval: "15m",
  direction: "AUTO",
  scenario: "pullback",
  condition: "candle_close",
});
const preferences = { ...defaultTradePreferences, symbol: "ETH-USD", holding: "hybrid" as const };
describe("complete allowed scenario search", () => {
  it("includes Breakout after Pullback and every supported automatic condition", () => {
    const candidates = tradeSetupCandidates(request, preferences);
    expect(candidates).toHaveLength(20);
    expect(
      candidates.some((c) => c.interval === "5m" && c.scenario === "breakout" && c.condition === "candle_close"),
    ).toBe(true);
    expect(candidates.some((c) => c.scenario === "breakout" && c.condition === "touch")).toBe(false);
  });
  it("preserves fixed scenario, condition and entry/trend intervals", () => {
    const manual = {
      ...preferences,
      entryPolicy: {
        ...resolveEntryPolicy(preferences),
        timeframeMode: "manual" as const,
        scenario: "pullback" as const,
        condition: "break_retest" as const,
      },
    };
    expect(tradeSetupCandidates(request, manual)).toEqual([
      {
        ...request,
        interval: manual.interval,
        trendInterval: manual.entryPolicy.trendInterval,
        scenario: "pullback",
        condition: "break_retest",
      },
    ]);
  });
  it("does not declare no setup before reviewing the alternate scenario", async () => {
    const evaluate = jest.fn(async (candidate) => ({
      plan: candidate.interval === "5m" && candidate.scenario === "breakout" ? { symbol: "ETH-USD" } : null,
      reason: null,
      sources: [],
    }));
    const result = await searchTradeSetups(
      tradeSetupCandidates(request, preferences),
      preferences,
      evaluate as never,
      new AbortController().signal,
    );
    expect(result.plan).not.toBeNull();
    expect(result.attempts.at(-1)?.scenario).toBe("breakout");
    expect(result.attempts.at(-1)?.outcome).toBe("ready");
  });
});
