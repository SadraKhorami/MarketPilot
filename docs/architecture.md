# MarketPilot Architecture

## Current implementation

The repository is a pnpm/Turborepo monorepo. `apps/web` is the Next.js dashboard, `apps/api` is the NestJS REST API, `apps/worker` runs controlled RSS ingestion, `packages/db` owns Prisma schema/migrations, `packages/market-data` owns provider contracts, external market-data adapters, validation, and pure indicator calculations, and `packages/news` owns RSS parsing. PostgreSQL is authoritative for product/news records; Redis backs rate limits, market observation caching, and RSS fetch state. GitHub Actions runs lint, formatting, type checks, tests, and production builds.

`marketsentinel-marketfeed` on the Desktop is a read-only reference for market-data pipeline ideas. MarketPilot does not call its HTTP server, import its code, share its token/database, or adopt its backend architecture.

## Responsibilities and dependency direction

- `apps/web` calls only authenticated MarketPilot API routes. It does not call market-data vendors or hold their credentials.
- `apps/api` owns authentication, authorization, request validation, REST/OpenAPI contracts, cache policy, and orchestration of product services.
- `apps/worker` refreshes approved RSS feeds and persists normalized articles. Market data is fetched on demand by the API in this phase.
- `packages/db` owns the Prisma schema, migrations, and database client.
- `packages/market-data` defines canonical market types, validates external responses, normalizes provider products/candles, and calculates indicators without NestJS or UI dependencies. `CoinbaseExchangeProvider` is the current provider adapter.
- `packages/news` validates and normalizes RSS articles independently of market-data providers. Ingestion remains disabled until source-use permission is confirmed.
- AI and bot integrations remain future work and must call MarketPilot application services rather than vendor APIs directly.

Dependency flow: web -> API -> market-data service -> provider adapter; API/worker -> application services -> database and Redis. Provider response shapes stop at the adapter boundary.

## Market-data path

The authenticated endpoint is `GET /api/v1/market-data/:symbol?interval=15m`. The NestJS `MarketDataModule` selects the `MarketDataProvider` implementation and `MarketDataService` handles normalized requests, Redis caching, stale fallback, and error mapping. The Coinbase Exchange adapter retrieves a public product ticker and candle history over HTTPS, validates and orders OHLCV candles, then returns canonical data. Technical calculations run in pure functions in `packages/market-data`.

Current product IDs use exact Coinbase Exchange format such as `BTC-USD`. Unsupported products return an explicit error; MarketPilot does not change quote currency, fabricate values, or claim FX coverage. Supported intervals are `1m`, `5m`, `15m`, `1h`, `6h`, and `1d`. Ticker timestamp and provider symbol are retained as provenance. Sentiment is unavailable because the market-data provider does not supply a verified sentiment result.

Redis caches successful observations for 60 seconds and retains them for up to 15 minutes for explicitly stale fallback. Invalid cached JSON/schema is discarded. Provider failures without a valid cached observation become a stable unavailable response. No candle/indicator data is persisted to PostgreSQL or presented as a simulated live stream.

## External boundaries and security

NestJS validates user input; the provider adapter validates upstream values and OHLC invariants. External calls use a fixed HTTPS host, bounded timeout, and provider rate limits. Provider errors are normalized without returning raw payloads or credentials. Market-data provider requests originate only from the API process; browser clients use the MarketPilot session cookie.

News ingestion uses configurable official RSS feeds and stays disabled until storage/display terms permit the planned use. External news text is untrusted input. AI, Telegram, Discord, BullMQ alert queues, and scheduled summaries are not implemented in this phase.

## References

- [Product specification](product-spec.md)
- [Integration notes](integrations.md)
- [MarketSentinel MarketFeed source audit](marketfeed-audit.md) — historical reference only, not a runtime dependency.
