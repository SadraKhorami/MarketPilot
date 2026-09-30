import { CoinbaseExchangeProvider, type MarketInstrument, referenceMarkets } from "@marketpilot/market-data";
import { Injectable } from "@nestjs/common";

@Injectable()
export class MarketCatalogService {
  private cached: { instruments: MarketInstrument[]; fetchedAt: string } | null = null;
  private pending: Promise<{ instruments: MarketInstrument[]; fetchedAt: string }> | null = null;
  constructor(private readonly coinbase: CoinbaseExchangeProvider) {}

  async list() {
    let error: string | null = null;
    if (!this.cached || Date.now() - Date.parse(this.cached.fetchedAt) > 600_000) {
      try {
        this.pending ??= this.coinbase
          .listMarkets()
          .then((instruments) => ({ instruments, fetchedAt: new Date().toISOString() }));
        this.cached = await this.pending;
      } catch {
        error = "Crypto market discovery is temporarily unavailable.";
      } finally {
        this.pending = null;
      }
    }
    return {
      instruments: [...(this.cached?.instruments ?? []), ...referenceMarkets],
      fetchedAt: this.cached?.fetchedAt ?? null,
      stale: Boolean(error && this.cached),
      error,
      connections: {
        crypto: error ? "unavailable" : "connected",
        multiAsset: "configured",
      },
    };
  }
}
