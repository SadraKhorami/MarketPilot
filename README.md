# MarketPilot

**AI-powered market intelligence**

MarketPilot is a market intelligence SaaS for monitoring assets, trends, news, alerts, and integrations. The Next.js dashboard connects to a NestJS API. MarketPilot fetches Coinbase Exchange product prices and candles through its own provider adapter, validates the response, and calculates technical indicators in a shared TypeScript package. Unsupported products and unavailable observations are shown as unavailable. The AI Analyst is implemented using OpenRouter and authenticated application tools; a server key and compatible model are required. Telegram/Discord linking, commands and alert delivery are implemented; live use requires server credentials and webhook registration.

## Workspace

The web app is based on the completed [Next.js shadcn admin dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard), substantially adapted for MarketPilot. The source dashboard's MIT notice is retained at `apps/web/LICENSE`; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The repository contains a Next.js app in `apps/web`, a NestJS REST API in `apps/api`, an alert/background-job and controlled RSS ingestion worker in `apps/worker`, and shared packages for the database, market-data providers and calculations, news source parsing, and validated AI provider contracts. The Desktop MarketFeed repository is an inspection reference only; MarketPilot does not call or depend on it. OpenRouter AI research, secure Telegram/Discord account linking, private bot commands and opted-in market alert delivery are implemented. Live bot use requires server configuration and webhook registration.

## Run locally

Requirements: Node.js 22+, pnpm 10.26+, and Docker Compose.

```bash
cp .env.example .env
pnpm install
pnpm dev:infra
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The dashboard opens at `http://localhost:3000`; the API listens at `http://localhost:4000/api/v1`. Swagger is available at `http://localhost:4000/api/v1/docs`. Registration creates a regular user account. To bootstrap an administrator, set `BOOTSTRAP_ADMIN_EMAIL` and a strong `BOOTSTRAP_ADMIN_PASSWORD` in `.env` before running `pnpm db:seed`; existing passwords are not overwritten by seed runs.

Market-data requests use Coinbase Exchange public product endpoints directly from the MarketPilot API; no Desktop service or provider token is required for this adapter. Use exact product identifiers such as `BTC-USD`; a USDT pair is never silently converted to a USD pair. Investing.com RSS ingestion is disabled by default. Enable it only after written permission for the intended storage/display use, as described in [integration notes](docs/integrations.md).

## Account and administration workspaces

Developer API keys provide scoped read access to market data, sourced news, watchlists and alert rules. The Usage page counts API-key requests only; browser traffic is visible separately in Administration. The developer area groups keys, paginated owned request history and endpoint documentation. Its guide includes curl, Node.js and Python examples, exact scope/envelope/pagination contracts and actual rate-limit headers. Keys are displayed once, never recoverable, and explicit bearer requests cannot inherit a browser session. See [Phase 7 developer API](docs/developer-api.md) for setup, Redis outage behavior, data freshness and limitations.

Administrators have a separate protected sidebar for overview metrics, account directory/details, request logs, audit events, API key inventory and system checks. Payments displays an unavailable state until billing is implemented. No financial records or integrations are simulated.

See [administration and developer API](docs/administration-and-developer-api.md) for boundaries and verification.

## Workspace commands

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm run ci
```

Tests use mocked persistence for deterministic auth, authorization, watchlist, alert, and API-key coverage. GitHub Actions starts PostgreSQL and Redis, applies the checked-in Prisma migration, and runs the same checks.

GitHub Actions runs the same checks on pull requests and pushes to `main`.

## Project docs

- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Database proposal](docs/database.md)
- [Integration and security design](docs/integrations.md)
- [Desktop MarketFeed source audit](docs/marketfeed-audit.md) (reference only)

## Notification center

The navbar bell and `/dashboard/notifications` use a real personal inbox with unread counts, filters, pagination, read/unread, archive/restore and related-page shortcuts. Administrators manage reviewed announcements at `/dashboard/admin/notifications`; publishing respects account preferences and provides aggregate delivery/read counts. Security and registration notices are generated from current events. Market alerts use the same inbox. Telegram and Discord market alerts have independent opted-in delivery records; email and device-push delivery remain unavailable. See [notification center](docs/notification-center.md).

## AI Analyst (Phase 4)

Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` on the server and restart the API. Leave secrets empty in examples. The configured model must appear in OpenRouter's catalog and support `tools`, `tool_choice` and `structured_outputs`. `OPENROUTER_BASE_URL` defaults to the fixed official HTTPS API; alternate hosts are rejected. Apply the checked-in migrations with `pnpm --filter @marketpilot/db migrate:deploy` before starting the updated API. Without configuration the workspace shows a compact unavailable state; there is no fake provider or fallback model in the product.

Research uses the current browser session and owned watchlist, streams honest progress, and returns validated observation/source cards with a separate qualitative interpretation. Cancellation stops application orchestration; non-streaming upstream inference may still be billed. Private turns are retained for seven days, with bounded request-triggered cleanup and the latest twenty turns displayed. AI metrics appear in Administration → System; API-key Usage remains separate. See [AI Analyst API and limits](docs/ai-analyst.md).

Alert proposals require an expiring, separate confirmation. Confirmed rules are evaluated by the Phase 5 worker with dashboard inbox delivery. Sentiment scoring, historical watchlist changes, payments and deployment remain unavailable. Bots reuse this research service and require browser confirmation of alert proposals.

## Alert engine and background jobs (Phase 5)

BullMQ refreshes grouped active markets, evaluates price/RSI/completed-candle percentage crossings and delivers owned market alerts to the inbox. PostgreSQL observation/trigger outboxes and unique notification keys recover queue publication failures and prevent duplicate delivery. Administration → System shows real queue counts, worker heartbeats, pending/failed jobs and safe failed-job retry. RSS ingestion remains independent and disabled by default.

Apply `pnpm --filter @marketpilot/db migrate:deploy` and build shared dependencies before launching the updated API/worker. `pnpm dev` starts the worker with the applications; production uses `pnpm --filter @marketpilot/worker start` after builds. See [alert engine setup, semantics, configuration and recovery](docs/alert-engine.md). Telegram and Discord delivery use independent durable per-channel outboxes; see the Phase 6 guide below.

## Telegram and Discord (Phase 6)

Bots pages now support temporary one-time link tokens, verified private platform identity, browser confirmation, disconnect/relink, explicit market-alert opt-in and paginated actual delivery history. Both providers share owned price/research/watchlist/alert commands. Discord responses are ephemeral; external alerts use private DMs. Administration → System separates configuration, worker readiness and observed connectivity, with sanitized errors and bounded recovery. No bot credentials are exposed to the browser and no bot request is billed as customer API-key traffic.

Configure server secrets, apply the two additive bot migrations, build `@marketpilot/bots`, and restart the API/worker. Both use HTTPS webhooks; local development needs a tunnel. Run the explicit `pnpm bots:setup telegram` or `pnpm bots:setup discord` registration command after configuration. See [bot setup, linking, commands, privacy and delivery guarantees](docs/bot-integrations.md). Provider acceptance cannot be committed atomically with the database, so exactly-once external delivery is not promised.

## Developer platform (Phase 7)

The existing API key lifecycle and read API are completed with catalog-driven permission choices, transactionally recorded create/revoke audit events, no-store credential responses, per-key usage shortcuts, searchable filters, UTC reporting and paginated request history. Redis key windows return `X-RateLimit-Limit`, `X-RateLimit-Window`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `X-RateLimit-Mode` and actionable `Retry-After` on 429. The guide and Swagger describe all eight existing supported GET routes; no sentiment or write endpoint is advertised.

No additional database migration or provider configuration is required. Existing running services and bot webhook settings were not deliberately stopped, restarted or reconfigured. Phase 7 verification is static only; no automated tests or browser tabs were run. See [developer API contracts, examples and limits](docs/developer-api.md).
