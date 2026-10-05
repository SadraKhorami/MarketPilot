import { MarketCatalogService } from "./market-catalog.service";

const instrument = {
  symbol: "ETH-USD",
  name: "Ether",
  baseAsset: "ETH",
  quoteAsset: "USD",
  assetClass: "crypto",
  provider: "coinbase-exchange",
  providerSymbol: "ETH-USD",
  available: true,
};
function setup(stored: string | null = null) {
  const coinbase = { listMarkets: jest.fn().mockResolvedValue([instrument]) };
  const redis = { ensureConnected: jest.fn(), client: { get: jest.fn().mockResolvedValue(stored), set: jest.fn() } };
  const service = new MarketCatalogService(coinbase as never, redis as never);
  return { service, coinbase, redis };
}
describe("market discovery recovery", () => {
  it("persists a verified catalog and restores it during a provider failure after restart", async () => {
    const first = setup();
    expect((await first.service.list()).instruments.some((i) => i.symbol === "ETH-USD")).toBe(true);
    expect(first.redis.client.set).toHaveBeenCalled();
    const snapshot = JSON.stringify({
      instruments: [instrument],
      fetchedAt: new Date(Date.now() - 700_000).toISOString(),
    });
    const restarted = setup(snapshot);
    restarted.coinbase.listMarkets.mockRejectedValue(new Error("offline"));
    const result = await restarted.service.list();
    expect(result.instruments.some((i) => i.symbol === "ETH-USD")).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.connections.crypto).toBe("unavailable");
  });
  it("ignores corrupt cached discovery and recovers through the live provider", async () => {
    const { service } = setup("invalid JSON");
    const result = await service.list();
    expect(result.connections.crypto).toBe("connected");
    expect(result.instruments.some((i) => i.symbol === "WTI-USD")).toBe(true);
  });
});
