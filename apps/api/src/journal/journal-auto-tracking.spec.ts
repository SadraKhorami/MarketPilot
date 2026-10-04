import { TradeSetupSchema } from "@marketpilot/ai";
import { trackAutomatic } from "./journal-auto-tracking";
import { netResult } from "./journal-trades.service";
import { journalEditVersion } from "./journal-edit-version";
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
const snapshot = (candles: ReturnType<typeof candle>[]) => ({ source: "test-only", data: { candles } });
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
  it("opens after a provable minute touch and automatically records TP", async () => {
    const { entry, tx } = simulation();
    await trackAutomatic(
      tx as never,
      entry as never,
      snapshot([
        candle(start, { open: 99, high: 101, low: 98, close: 101 }),
        candle(start + 60_000, { open: 101, high: 111, low: 100, close: 110 }),
      ]) as never,
      snapshot([candle()]) as never,
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
      snapshot([candle()]) as never,
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
      snapshot([candle()]) as never,
    );
    expect(tx.journalExit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 1 }) }),
    );
    expect(netResult(entry as never)).toBeNull();
    expect(tx.journalEntry.update.mock.calls.every(([call]) => !("quantity" in call.data))).toBe(true);
  });
  it("does not use a minute close to satisfy a fifteen-minute close rule", async () => {
    const { entry, tx } = simulation("candle_close");
    await trackAutomatic(tx as never, entry as never, snapshot([candle()]) as never, snapshot([]) as never);
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "planned" }) }),
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
      snapshot([]) as never,
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
      snapshot([]) as never,
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
      snapshot([]) as never,
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
      snapshot([]) as never,
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
      snapshot([]) as never,
    );
    expect(tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ monitoringStatus: "Needs review · deadline minute timing unknown" }),
      }),
    );
    expect(tx.journalExit.create).not.toHaveBeenCalled();
  });
});
