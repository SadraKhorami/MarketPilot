import { CoinbaseExchangeProvider, MarketInstrumentSchema, referenceMarkets } from "@marketpilot/market-data";
import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { RedisService } from "../redis.service";

const cacheKey = "marketpilot:market-catalog:v1";
const catalogSchema = z.object({
  instruments: z.array(MarketInstrumentSchema).min(1),
  fetchedAt: z.string().datetime(),
});
type CatalogSnapshot = z.infer<typeof catalogSchema>;

@Injectable()
export class MarketCatalogService {
  private cached: CatalogSnapshot | null = null;
  private pending: Promise<CatalogSnapshot> | null = null;
  constructor(
    private readonly coinbase: CoinbaseExchangeProvider,
    private readonly redis: RedisService,
  ) {}

  async list() {
    let error: string | null = null;
    if (!this.cached) {
      try {
        await this.redis.ensureConnected();
        const stored = await this.redis.client.get(cacheKey);
        const parsed = catalogSchema.safeParse(stored ? JSON.parse(stored) : null);
        if (parsed.success && Date.parse(parsed.data.fetchedAt) <= Date.now()) this.cached = parsed.data;
      } catch {
        /* Live discovery remains available without cache storage. */
      }
    }
    if (!this.cached || Date.now() - Date.parse(this.cached.fetchedAt) > 600_000) {
      try {
        this.pending ??= this.coinbase
          .listMarkets()
          .then((instruments) => catalogSchema.parse({ instruments, fetchedAt: new Date().toISOString() }));
        this.cached = await this.pending;
        try {
          await this.redis.ensureConnected();
          await this.redis.client.set(cacheKey, JSON.stringify(this.cached), "EX", 7 * 86_400);
        } catch {
          /* Preserve the successful in-memory discovery if Redis is unavailable. */
        }
      } catch {
        error = this.cached
          ? "Crypto market discovery is temporarily unavailable. Showing the last verified catalog."
          : "Crypto market discovery is temporarily unavailable.";
      } finally {
        this.pending = null;
      }
    }
    return {
      instruments: [...(this.cached?.instruments ?? []), ...referenceMarkets],
      fetchedAt: this.cached?.fetchedAt ?? null,
      stale: Boolean(error && this.cached),
      error,
      connections: { crypto: error ? "unavailable" : "connected", multiAsset: "configured" },
    };
  }
}
