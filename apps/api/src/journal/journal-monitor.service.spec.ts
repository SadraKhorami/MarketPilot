import { TradeSetupSchema } from "@marketpilot/ai";
import { JournalMonitorService } from "./journal-monitor.service";

const start = Date.parse("2026-10-04T10:00:00Z");
function fixture(symbol = "BTC-USD") {
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
  const entry = {
    id: "fixture",
    symbol: "BTC-USD",
    plan,
    status: "open",
    trackingMode: "observed",
    source: "manual",
    createdAt: new Date(start),
    openedAt: new Date(start),
    checkedAt: new Date(start),
    updatedAt: new Date(start),
    events: [],
    exits: [],
  };
  const tx = {
    $queryRaw: jest.fn(),
    journalEntry: { findUniqueOrThrow: jest.fn().mockResolvedValue(entry), update: jest.fn() },
    journalEvent: { create: jest.fn() },
  };
  const db = {
    journalEntry: { findMany: jest.fn().mockResolvedValue([entry]), updateMany: jest.fn() },
    journalEvent: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: async (action: (client: typeof tx) => unknown) => action(tx),
  };
  const market = {
    getMarketData: jest.fn().mockResolvedValue({
      source: "test-only",
      requestedSymbol: symbol,
      freshness: "fresh",
      fetchedAt: new Date(start + 899_000).toISOString(),
      data: {
        symbol,
        interval: "15m",
        candles: [{ time: new Date(start).toISOString(), open: 100, high: 111, low: 99, close: 110, volume: 1 }],
      },
    }),
  };
  const journal = { expirePlans: jest.fn(), review: jest.fn() };
  return { entry, tx, db, market, service: new JournalMonitorService(db as never, market as never, journal as never) };
}
describe("observed journal integrity", () => {
  beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(start + 1800_000));
  afterEach(() => jest.restoreAllMocks());
  it("does not create a target observation from a cached forming candle", async () => {
    const f = fixture();
    await f.service.monitor();
    expect(f.tx.journalEvent.create).not.toHaveBeenCalled();
    expect(f.tx.journalEntry.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ checkedAt: new Date(start) }) }),
    );
  });
  it("rejects a different symbol before opening a transaction", async () => {
    const f = fixture("SOL-USD");
    await f.service.monitor();
    expect(f.tx.journalEntry.update).not.toHaveBeenCalled();
    expect(f.db.journalEntry.updateMany).toHaveBeenCalled();
  });
  it("discards fetched observations if the tracking mode changes before the row lock", async () => {
    const f = fixture();
    f.tx.journalEntry.findUniqueOrThrow.mockResolvedValue({ ...f.entry, trackingMode: "automatic" });
    await f.service.monitor();
    expect(f.tx.journalEntry.update).not.toHaveBeenCalled();
  });
});
