import { assessTradeEconomics, defaultTradePreferences, resolveEntryPolicy, TradeSetupSchema } from "@marketpilot/ai";
import { JournalService } from "./journal.service";

const proposalTime = Date.parse("2026-10-04T19:34:14.456Z");
const saveTime = Date.parse("2026-10-04T19:34:28.950Z");
const runId = "00000000-0000-4000-8000-000000000001";
function fixture() {
  const prices = { entry: 100, stopLoss: 90, targets: [130], direction: "BUY" as const };
  const quality = assessTradeEconomics(prices, 0);
  if (!quality.accepted) throw new Error(quality.reason);
  const context = {
    ...defaultTradePreferences,
    symbol: "BTC-USD",
    capital: 1000,
    entryPolicy: { ...resolveEntryPolicy(defaultTradePreferences), roundTripCostPercent: 0 },
  };
  const plan = TradeSetupSchema.parse({
    ...prices,
    symbol: "BTC-USD",
    interval: "15m",
    contextInterval: "1h",
    stage: "waiting_close",
    observedPrice: 99,
    observedAt: new Date(proposalTime).toISOString(),
    expiresAt: "2026-10-04T20:15:00.000Z",
    quote: "USD",
    pipSize: null,
    sourceId: "fixture",
    conditionalEntry: {
      version: 2,
      scenario: "breakout",
      condition: "candle_close",
      trendInterval: "1h",
      timeframeMode: "auto",
      validityMode: "auto",
      validityCandles: 3,
      validityBasis: "entry_candle_closes",
      proposedAt: new Date(proposalTime).toISOString(),
      breakoutAt: null,
      rationale: "Test-only structure",
      validityReason: "Test-only deadline",
      invalidation: { kind: "stop_before_entry", price: 90 },
      atr: 10,
      maxEntryDistance: 15,
      news: {
        status: "unavailable",
        latestPublishedAt: null,
        checkedAt: new Date(proposalTime).toISOString(),
        sourceIds: [],
        calendar: "unavailable",
      },
      executionData: { spread: "unavailable", fees: "unavailable", liquidity: "unavailable" },
      economics: quality.economics,
      sizing: { capitalBasis: "user_supplied", riskAmount: 10, baseUnits: 1, reason: "Test-only sizing" },
    },
  });
  const run = {
    tradeContext: context,
    result: {
      runId,
      conversationId: runId,
      tradeSetup: plan,
      proposals: [],
      tools: [],
      answer: {
        interpretation: [{ text: "Observed structure supports a conditional scenario.", sourceIds: ["fixture"] }],
      },
      sources: [
        {
          id: "fixture",
          kind: "market",
          title: "BTC-USD",
          source: "test-only",
          symbol: "BTC-USD",
          status: "ok",
          freshness: "fresh",
          observedAt: new Date(proposalTime).toISOString(),
          fetchedAt: new Date(proposalTime).toISOString(),
          url: null,
          facts: [],
          history: [],
          interval: "15m",
          windowStart: null,
          windowEnd: null,
          excerpt: null,
          error: null,
        },
      ],
    },
  };
  const snapshot = {
    freshness: "fresh",
    requestedSymbol: "BTC-USD",
    data: {
      symbol: "BTC-USD",
      interval: "15m",
      timestamp: new Date(saveTime).toISOString(),
      price: 99,
      marketStatus: { isOpen: true },
    },
  };
  const tx = {
    $queryRaw: jest.fn(),
    journalEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: "saved" }),
    },
  };
  const db = {
    journalEntry: { findUnique: jest.fn().mockResolvedValue(null) },
    aiRun: { findFirst: jest.fn().mockResolvedValue(run) },
    $transaction: jest.fn(async (action: (client: typeof tx) => unknown) => action(tx)),
  };
  const market = { getMarketData: jest.fn().mockResolvedValue(snapshot) };
  const service = new JournalService(db as never, market as never, {} as never, {} as never, null, {} as never);
  jest.spyOn(service, "detail").mockResolvedValue({ id: "saved" } as never);
  return { service, tx, db, plan, run, snapshot };
}

describe("confirmed AI save contract", () => {
  beforeEach(() => jest.useFakeTimers({ now: saveTime }));
  afterEach(() => jest.useRealTimers());
  it("saves server levels, costs and sizing unchanged and starts monitoring at confirmation without extending validity", async () => {
    const f = fixture();
    await f.service.save("owner", runId);
    expect(f.tx.journalEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          plan: f.plan,
          quantity: 1,
          targetAllocations: [100],
          entryTrigger: "close_above",
          trackingMode: "automatic",
          checkedAt: new Date(saveTime),
        }),
      }),
    );
    expect(f.plan.expiresAt).toBe("2026-10-04T20:15:00.000Z");
  });
  it.each(["stale", "different market", "stop", "chase", "expired"])(
    "refuses %s evidence before writing a plan",
    async (reason) => {
      const f = fixture();
      if (reason === "stale") f.snapshot.freshness = "stale";
      if (reason === "different market") f.snapshot.data.symbol = "SOL-USD";
      if (reason === "stop") f.snapshot.data.price = 89;
      if (reason === "chase") f.snapshot.data.price = 104;
      if (reason === "expired") jest.setSystemTime(Date.parse(f.plan.expiresAt));
      await expect(f.service.save("owner", runId)).rejects.toThrow();
      expect(f.db.$transaction).not.toHaveBeenCalled();
    },
  );
  it("rejects modified economic assessment or sizing instead of silently recalculating the proposal", async () => {
    for (const field of ["economics", "sizing"] as const) {
      const f = fixture();
      const rule = f.plan.conditionalEntry;
      if (!rule?.economics) throw new Error("Missing fixture economics");
      if (field === "economics") rule.economics.netRewardRisk = 99;
      else rule.sizing.baseUnits = 2;
      await expect(f.service.save("owner", runId)).rejects.toThrow();
      expect(f.db.$transaction).not.toHaveBeenCalled();
    }
  });
});
