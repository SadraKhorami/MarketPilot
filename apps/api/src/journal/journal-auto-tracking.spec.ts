import { assessTradeEconomics, TradeSetupSchema } from "@marketpilot/ai";
import { trackAutomatic } from "./journal-auto-tracking";
import { journalEditVersion } from "./journal-edit-version";
import { netResult } from "./journal-trades.service";

const start = Date.parse("2026-10-04T10:00:00Z");
const plan = TradeSetupSchema.parse({
  symbol: "BTC-USD",
  direction: "BUY",
  interval: "15m",
  stage: "confirmed",
  entry: 100,
  stopLoss: 90,
  targets: [110],
  observedPrice: 100,
  observedAt: new Date(start).toISOString(),
  expiresAt: new Date(start + 3600_000).toISOString(),
  quote: "USD",
  pipSize: null,
  sourceId: "fixture",
});
function setup(status = "open", trigger = "touch", offset = 0) {
  const entry = {
    id: "fixture",
    userId: "owner",
    symbol: "BTC-USD",
    plan,
    status,
    entryTrigger: trigger,
    quantity: 2,
    entryPrice: status === "open" ? 100 : null,
    createdAt: new Date(start + offset),
    openedAt: status === "open" ? new Date(start + offset) : null,
    checkedAt: new Date(start + offset),
    fees: 10,
    targetAllocations: [100],
    trackingMode: "automatic",
    resultBasis: "recorded",
    notes: "",
    exitPrice: null,
    closedAt: null,
    archivedAt: null,
    updatedAt: new Date(start),
    exits: [],
    events: [],
  };
  const tx = {
    journalEntry: { update: jest.fn().mockResolvedValue({}) },
    journalEvent: { create: jest.fn().mockResolvedValue({}) },
    journalExit: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "exit", ...data })) },
  };
  return { entry, tx };
}
const candle = (time = start, prices = { open: 100, high: 105, low: 95, close: 102 }) => ({
  time: new Date(time).toISOString(),
  volume: 1,
  ...prices,
});
const makeSnapshot = (candles: ReturnType<typeof candle>[], interval = "15m", fetchedAt = Date.now()) => ({
  source: "test-only",
  fetchedAt: new Date(fetchedAt).toISOString(),
  data: { candles, interval },
});
const snapshot = (candles: ReturnType<typeof candle>[]) => makeSnapshot(candles);
describe("journal completed-candle integrity", () => {
  beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(start + 1800_000));
  afterEach(() => jest.restoreAllMocks());
  it("does not estimate an exit before a close-triggered entry in the same candle", async () => {
    const { entry, tx } = setup("planned", "close_above", 60_000);
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([candle(start, { open: 99, low: 95, high: 112, close: 101 })]) as never,
    );
    expect(tx.journalExit.create).not.toHaveBeenCalled();
    expect(tx.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "open", entryPrice: 101, resultBasis: "estimated" }),
      }),
    );
  });
  it("pauses when a touch could have happened before the start time", async () => {
    const { entry, tx } = setup("planned", "touch", 60_000);
    await trackAutomatic(tx as never, entry as never, snapshot([candle()]) as never);
    expect(tx.journalExit.create).not.toHaveBeenCalled();
    expect(tx.journalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "ambiguous" }) }),
    );
  });
  it("cannot infer ordering when SL and TP share a candle", async () => {
    const { entry, tx } = setup();
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([candle(start, { open: 100, low: 85, high: 115, close: 100 })]) as never,
    );
    expect(tx.journalExit.create).not.toHaveBeenCalled();
    expect(tx.journalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "ambiguous" }) }),
    );
  });
  it("a stop gap uses observed opening price and keeps the result estimated", async () => {
    const { entry, tx } = setup();
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([candle(start, { open: 85, low: 80, high: 89, close: 88 })]) as never,
    );
    expect(tx.journalExit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ price: 85, quantity: 2, basis: "estimated" }),
    });
  });
  it("pauses even when exactly one starting candle is missing", async () => {
    const { entry, tx } = setup();
    await trackAutomatic(tx as never, entry as never, snapshot([candle(start + 900_000)]) as never);
    expect(tx.journalExit.create).not.toHaveBeenCalled();
    expect(tx.journalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: "gap" }) }),
    );
  });
  it("allocates entry fees once across partial exits", () => {
    const { entry } = setup();
    expect(netResult({ ...entry, entryPrice: 100, exits: [{ price: 120, quantity: 1, fees: 3 }] })).toBe(12);
    expect(
      netResult({
        ...entry,
        entryPrice: 100,
        exits: [
          { price: 120, quantity: 1, fees: 3 },
          { price: 110, quantity: 1, fees: 2 },
        ],
      }),
    ).toBe(15);
  });
  it("ignores monitor updates but catches actual edits in edit versions", () => {
    const { entry } = setup();
    const version = journalEditVersion(entry as never);
    expect(
      journalEditVersion({
        ...entry,
        updatedAt: new Date(),
        checkedAt: new Date(),
        monitoringStatus: "Checked",
      } as never),
    ).toBe(version);
    expect(journalEditVersion({ ...entry, notes: "Changed" } as never)).not.toBe(version);
  });
});

describe("AI trade simulations", () => {
  const snapshot = (candles: ReturnType<typeof candle>[]) => makeSnapshot(candles, "1m");
  const confirmationSnapshot = (candles: ReturnType<typeof candle>[]) => makeSnapshot(candles);
  beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(start + 1800_000));
  afterEach(() => jest.restoreAllMocks());
  function simulation(condition = "touch") {
    const fixture = setup("planned");
    fixture.entry.plan = TradeSetupSchema.parse({
      ...plan,
      contextInterval: "1h",
      conditionalEntry: {
        version: 2,
        scenario: "pullback",
        condition,
        trendInterval: "1h",
        timeframeMode: "auto",
        validityMode: "auto",
        validityCandles: 4,
        breakoutAt: new Date(start - 900_000).toISOString(),
        proposedAt: new Date(start).toISOString(),
        rationale: "Fixture",
        validityReason: "Fixture",
        invalidation: { kind: "stop_before_entry", price: 90 },
        atr: 2,
        maxEntryDistance: 3,
        news: {
          status: "unavailable",
          latestPublishedAt: null,
          checkedAt: new Date(start).toISOString(),
          sourceIds: [],
          calendar: "unavailable",
        },
        executionData: { spread: "unavailable", fees: "unavailable", liquidity: "unavailable" },
        sizing: { capitalBasis: "user_supplied", riskAmount: null, baseUnits: null, reason: "Not supplied" },
      },
    });
    return fixture;
  }
  it("deducts estimated round-trip costs from each simulated exit", async () => {
    const { entry, tx } = simulation();
    entry.fees = 0;
    entry.status = "open";
    entry.entryPrice = 100;
    entry.plan.targets = [120];
    const quality = assessTradeEconomics(entry.plan, 1);
    if (!quality.accepted) throw new Error(quality.reason);
    entry.plan.conditionalEntry!.economics = quality.economics;
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([candle(start, { open: 110, high: 121, low: 100, close: 120 })]) as never,
      confirmationSnapshot([]) as never,
    );
    expect(tx.journalExit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fees: 2, quantity: 2, price: 120 }) }),
    );
  });
  it("does not deduct a recorded entry cost twice inside the round-trip estimate", async () => {
    const { entry, tx } = simulation();
    entry.status = "open";
    entry.entryPrice = 100;
    entry.fees = 0.5;
    entry.plan.targets = [120];
    const quality = assessTradeEconomics(entry.plan, 1);
    if (!quality.accepted) throw new Error(quality.reason);
    entry.plan.conditionalEntry!.economics = quality.economics;
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([candle(start, { open: 110, high: 121, low: 100, close: 120 })]) as never,
      confirmationSnapshot([]) as never,
    );
    expect(tx.journalExit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fees: 1.5 }) }),
    );
  });
  it("does not process a cached minute candle that was still forming when fetched", async () => {
    const { entry, tx } = simulation();
    entry.status = "open";
    entry.entryPrice = 100;
    await trackAutomatic(
      tx as never,
      entry as never,
      makeSnapshot([candle(start, { open: 100, high: 111, low: 99, close: 110 })], "1m", start + 30_000) as never,
      confirmationSnapshot([]) as never,
    );
    expect(tx.journalExit.create).not.toHaveBeenCalled();
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "open", checkedAt: new Date(start) }) }),
    );
  });
  it("does not open from a cached coarse confirmation that was forming when fetched", async () => {
    const { entry, tx } = simulation("candle_close");
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot(Array.from({ length: 15 }, (_, i) => candle(start + i * 60_000))) as never,
      makeSnapshot([candle()], "15m", start + 899_000) as never,
    );
    expect(tx.journalEntry.update.mock.calls.some(([call]) => call.data.status === "open")).toBe(false);
  });
  it("rejects a confirmed entry when its fill weakens the net reward/risk", async () => {
    const { entry, tx } = simulation("candle_close");
    entry.plan.targets = [120];
    const quality = assessTradeEconomics(entry.plan, 0);
    if (!quality.accepted) throw new Error(quality.reason);
    entry.plan.conditionalEntry!.economics = quality.economics;
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot(
        Array.from({ length: 15 }, (_, index) =>
          candle(
            start + index * 60_000,
            index === 14
              ? { open: 100, high: 105, low: 100, close: 105 }
              : { open: 99, high: 102, low: 98, close: 101 },
          ),
        ),
      ) as never,
      confirmationSnapshot([candle(start, { open: 99, high: 105, low: 98, close: 105 })]) as never,
    );
    expect(tx.journalEntry.update.mock.calls.some(([call]) => call.data.status === "open")).toBe(false);
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "cancelled" }) }),
    );
  });
  it.each(["risk", "cash"])(
    "rejects a close fill exceeding the supplied %s budget even when its ratio passes",
    async (budget) => {
      const { entry, tx } = simulation("candle_close");
      entry.plan.targets = [150];
      if (budget === "cash") {
        entry.plan.stopLoss = 99;
        if (!entry.plan.conditionalEntry) throw new Error("Missing fixture rule");
        entry.plan.conditionalEntry.invalidation.price = 99;
      }
      const quality = assessTradeEconomics(entry.plan, 0);
      if (!quality.accepted || !entry.plan.conditionalEntry) throw new Error("Missing fixture economics");
      entry.plan.conditionalEntry.economics = quality.economics;
      Object.assign(entry, {
        context: {
          capital: budget === "risk" ? 2000 : 200,
          currency: "USD",
          riskPercent: budget === "risk" ? 1 : 10,
          interval: "15m",
          holding: "day",
          autoReview: false,
          symbol: "BTC-USD",
        },
      });
      const prices = { open: 100, low: 100, high: 104, close: 102 };
      await trackAutomatic(
        tx as never,
        entry as never,
        snapshot(Array.from({ length: 15 }, (_, i) => candle(start + i * 60_000, prices))) as never,
        confirmationSnapshot([candle(start, prices)]) as never,
      );
      expect(tx.journalEntry.update.mock.calls.some(([call]) => call.data.status === "open")).toBe(false);
      expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "cancelled" }) }),
      );
      expect(tx.journalEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            key: "quality-rejected",
            evidence: expect.objectContaining({ message: expect.stringMatching(/capital or loss budget/) }),
          }),
        }),
      );
    },
  );
  it("opens after a provable minute touch and automatically records TP", async () => {
    const { entry, tx } = simulation();
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([
        candle(start, { open: 99, high: 101, low: 98, close: 101 }),
        candle(start + 60_000, { open: 101, high: 111, low: 100, close: 110 }),
      ]) as never,
      confirmationSnapshot([candle()]) as never,
    );
    expect(tx.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "open", entryPrice: 100 }) }),
    );
    expect(tx.journalExit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reason: "tp", quantity: 2, price: 110 }) }),
    );
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "closed" }) }),
    );
  });
  it("resolves a coarse start-candle ambiguity with minute data", async () => {
    const { entry, tx } = simulation();
    entry.createdAt = entry.checkedAt = new Date(start + 30_000);
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([
        candle(start, { open: 98, high: 99, low: 97, close: 99 }),
        candle(start + 60_000, { open: 99, high: 101, low: 99, close: 101 }),
      ]) as never,
      confirmationSnapshot([candle()]) as never,
    );
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "open" }) }),
    );
  });
  it("uses reference fills without inventing a monetary position", async () => {
    const { entry, tx } = simulation();
    Object.assign(entry, { quantity: null });
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([
        candle(start, { open: 99, high: 101, low: 98, close: 101 }),
        candle(start + 60_000, { open: 101, high: 111, low: 100, close: 110 }),
      ]) as never,
      confirmationSnapshot([candle()]) as never,
    );
    expect(tx.journalExit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 1 }) }),
    );
    expect(netResult(entry as never)).toBeNull();
    expect(tx.journalEntry.update.mock.calls.every(([call]) => !("quantity" in call.data))).toBe(true);
  });
  it("does not use a minute close to satisfy a fifteen-minute close rule", async () => {
    const { entry, tx } = simulation("candle_close");
    await trackAutomatic(tx as never, entry as never, snapshot([candle()]) as never, confirmationSnapshot([]) as never);
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "planned", checkedAt: new Date(start) }) }),
    );
  });
  for (const direction of ["BUY", "SELL"] as const) {
    it(`${direction} one-minute break/retest records a break and fills only a separate later retest`, async () => {
      const { entry, tx } = simulation("break_retest");
      entry.entryTrigger = "break_retest";
      entry.plan = TradeSetupSchema.parse({
        ...entry.plan,
        direction,
        interval: "1m",
        stopLoss: direction === "BUY" ? 90 : 110,
        targets: [direction === "BUY" ? 120 : 80],
        expiresAt: new Date(start + 240_000).toISOString(),
        conditionalEntry: {
          ...entry.plan.conditionalEntry,
          scenario: "breakout",
          breakoutAt: null,
          invalidation: { kind: "stop_before_entry", price: direction === "BUY" ? 90 : 110 },
        },
      });
      const breakCandle =
        direction === "BUY"
          ? { open: 99, low: 98, high: 103, close: 102 }
          : { open: 101, low: 97, high: 102, close: 98 };
      const retestCandle =
        direction === "BUY"
          ? { open: 102, low: 99, high: 104, close: 103 }
          : { open: 98, low: 96, high: 101, close: 97 };
      await trackAutomatic(
        tx as never,
        entry as never,
        snapshot([candle(start, breakCandle), candle(start + 60_000, retestCandle)]) as never,
      );
      expect(tx.journalEvent.create.mock.calls.map(([call]) => call.data.key)).toEqual(["auto:breakout", "auto:entry"]);
      expect(tx.journalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: "open",
            openedAt: new Date(start + 120_000),
            entryPrice: retestCandle.close,
          }),
        }),
      );
      expect(tx.journalExit.create).not.toHaveBeenCalled();
    });
  }
  it("retries a missing coarse confirmation boundary instead of losing the entry", async () => {
    const { entry, tx } = simulation("candle_close");
    entry.entryTrigger = "close_above";
    if (!entry.plan.conditionalEntry) throw new Error("Missing fixture rule");
    entry.plan.conditionalEntry.scenario = "breakout";
    entry.plan.conditionalEntry.breakoutAt = null;
    const minutes = Array.from({ length: 15 }, (_, i) => candle(start + i * 60_000));
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot(minutes) as never,
      makeSnapshot([candle()], "15m", start + 899_000) as never,
    );
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          checkedAt: new Date(start + 840_000),
          monitoringStatus: "Waiting for completed entry-timeframe data",
        }),
      }),
    );
    entry.checkedAt = new Date(start + 840_000);
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot(minutes) as never,
      confirmationSnapshot([candle()]) as never,
    );
    expect(tx.journalEvent.create.mock.calls.some(([call]) => call.data.kind === "breakout")).toBe(false);
    expect(tx.journalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: "auto:entry",
          evidence: expect.objectContaining({ interval: "15m", price: 102 }),
        }),
      }),
    );
    expect(tx.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "open", entryPrice: 102, openedAt: new Date(start + 900_000) }),
      }),
    );
  });
  it("uses observed coarse boundaries for retests and confirmation retries on a shifted candle grid", async () => {
    const { entry, tx } = simulation("candle_close");
    entry.entryTrigger = "close_above";
    entry.createdAt = entry.checkedAt = new Date(start + 300_000);
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot(Array.from({ length: 15 }, (_, i) => candle(start + 300_000 + i * 60_000))) as never,
      confirmationSnapshot([candle(start + 300_000)]) as never,
    );
    expect(tx.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "open", openedAt: new Date(start + 1200_000), entryPrice: 102 }),
      }),
    );
    expect(tx.journalEvent.create.mock.calls.some(([call]) => call.data.kind === "gap")).toBe(false);
  });
  it("does not invent a pullback from a retest before saving inside the coarse candle", async () => {
    const { entry, tx } = simulation("candle_close");
    entry.entryTrigger = "close_above";
    entry.createdAt = entry.checkedAt = new Date(start + 30_000);
    const minutes = Array.from({ length: 15 }, (_, i) =>
      candle(
        start + i * 60_000,
        i === 0 ? { open: 99, low: 98, high: 104, close: 102 } : { open: 102, low: 101, high: 104, close: 102 },
      ),
    );
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot(minutes) as never,
      confirmationSnapshot([candle()]) as never,
    );
    expect(tx.journalEntry.update.mock.calls.some(([call]) => call.data.status === "open")).toBe(false);
    expect(tx.journalEvent.create.mock.calls.some(([call]) => call.data.kind === "retest")).toBe(false);
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ monitoringStatus: "Needs review · start candle timing unknown" }),
      }),
    );
  });
  it("accepts a confirmation exactly at the deadline using its actual close", async () => {
    const { entry, tx } = simulation("candle_close");
    entry.entryTrigger = "close_above";
    entry.plan = TradeSetupSchema.parse({
      ...entry.plan,
      expiresAt: new Date(start + 900_000).toISOString(),
      conditionalEntry: { ...entry.plan.conditionalEntry, validityCandles: 1, validityBasis: "entry_candle_closes" },
    });
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot(Array.from({ length: 15 }, (_, i) => candle(start + i * 60_000))) as never,
      confirmationSnapshot([candle()]) as never,
    );
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "open" }) }),
    );
  });
  it("BTC legacy deadline: minute touches and a forming higher candle do not replace the saved close condition", async () => {
    // Synthetic minute coverage proves the timeframe distinction. Only the three
    // coarse closes and plan values are copied from the supplied read-only case.
    const { entry, tx } = simulation("candle_close");
    const proposedAt = Date.parse("2026-10-04T19:34:14.456Z");
    const savedAt = Date.parse("2026-10-04T19:34:28.950Z");
    const minuteStart = Date.parse("2026-10-04T19:34:00Z");
    const coarseStart = Date.parse("2026-10-04T19:30:00Z");
    const end = Date.parse("2026-10-04T20:20:00Z");
    jest.spyOn(Date, "now").mockReturnValue(end);
    entry.createdAt = entry.checkedAt = new Date(savedAt);
    entry.entryTrigger = "close_above";
    entry.plan = TradeSetupSchema.parse({
      ...entry.plan,
      entry: 85468.43,
      stopLoss: 85269.81,
      targets: [86885.28, 87178.19, 87249.05],
      observedPrice: 85460,
      observedAt: new Date(proposedAt).toISOString(),
      expiresAt: "2026-10-04T20:19:14.456Z",
      conditionalEntry: {
        ...entry.plan.conditionalEntry,
        scenario: "breakout",
        breakoutAt: null,
        validityCandles: 3,
        proposedAt: new Date(proposedAt).toISOString(),
        invalidation: { kind: "stop_before_entry", price: 85269.81 },
      },
    });
    entry.targetAllocations = [33, 33, 34];
    const minutes = Array.from({ length: 46 }, (_, i) =>
      candle(minuteStart + i * 60_000, { open: 85460, low: 85400, high: 85500, close: 85480 }),
    );
    const coarse = [85429.4, 85417.47, 85427.18, 85500].map((close, i) =>
      candle(coarseStart + i * 900_000, { open: 85460, low: 85400, high: 85500, close }),
    );
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot(minutes) as never,
      confirmationSnapshot(coarse) as never,
    );
    expect(tx.journalEntry.update.mock.calls.some(([call]) => call.data.status === "open")).toBe(false);
    expect(tx.journalExit.create).not.toHaveBeenCalled();
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "expired" }) }),
    );
    expect(tx.journalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ key: "expired", occurredAt: new Date("2026-10-04T20:19:14.456Z") }),
      }),
    );
  });
  it("closes automatically at SL using the worse observed gap price", async () => {
    const { entry, tx } = simulation();
    entry.status = "open";
    entry.entryPrice = 100;
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([candle(start, { open: 88, high: 89, low: 86, close: 87 })]) as never,
      confirmationSnapshot([]) as never,
    );
    expect(tx.journalExit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reason: "sl", price: 88 }) }),
    );
  });
  it("keeps an open simulation active past the entry deadline", async () => {
    const { entry, tx } = simulation();
    entry.status = "open";
    entry.entryPrice = 100;
    entry.checkedAt = new Date(start + 3600_000);
    jest.spyOn(Date, "now").mockReturnValue(start + 3660_000);
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([candle(start + 3600_000)]) as never,
      confirmationSnapshot([]) as never,
    );
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "open" }) }),
    );
  });
  it("allocates partial targets and closes the remainder at SL", async () => {
    const { entry, tx } = simulation();
    entry.status = "open";
    entry.entryPrice = 100;
    entry.plan = { ...entry.plan, targets: [110, 120] };
    entry.targetAllocations = [50, 50];
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([
        candle(start, { open: 100, high: 111, low: 99, close: 110 }),
        candle(start + 60_000, { open: 100, high: 101, low: 89, close: 90 }),
      ]) as never,
      confirmationSnapshot([]) as never,
    );
    expect(tx.journalExit.create.mock.calls.map(([call]) => [call.data.reason, call.data.quantity])).toEqual([
      ["tp", 1],
      ["sl", 1],
    ]);
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "closed" }) }),
    );
  });
  it("expires only after the complete entry window is checked", async () => {
    const { entry, tx } = simulation();
    jest.spyOn(Date, "now").mockReturnValue(start + 3660_000);
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot(
        Array.from({ length: 60 }, (_, i) => candle(start + i * 60_000, { open: 98, high: 99, low: 95, close: 98 })),
      ) as never,
      confirmationSnapshot([]) as never,
    );
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "expired" }) }),
    );
    expect(tx.journalExit.create).not.toHaveBeenCalled();
  });
  it("does not guess a touch inside the minute containing the deadline", async () => {
    const { entry, tx } = simulation();
    entry.plan = TradeSetupSchema.parse({
      ...entry.plan,
      expiresAt: new Date(start + 3630_000).toISOString(),
      conditionalEntry: { ...entry.plan.conditionalEntry, proposedAt: new Date(start + 30_000).toISOString() },
    });
    entry.checkedAt = new Date(start + 3600_000);
    jest.spyOn(Date, "now").mockReturnValue(start + 3660_000);
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([candle(start + 3600_000)]) as never,
      confirmationSnapshot([]) as never,
    );
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ monitoringStatus: "Needs review · deadline minute timing unknown" }),
      }),
    );
    expect(tx.journalExit.create).not.toHaveBeenCalled();
  });
});
