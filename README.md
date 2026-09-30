# MarketPilot

**AI-powered market intelligence**

MarketPilot is a market intelligence SaaS for monitoring assets, trends, news, sentiment, alerts, and integrations. The Next.js dashboard connects to a NestJS API. MarketPilot fetches Coinbase Exchange product prices and candles through its own provider adapter, validates the response, and calculates technical indicators in a shared TypeScript package. Unsupported products and unavailable observations are shown as unavailable. AI and bot integrations are not connected.

## Workspace

The web app is based on the completed [Next.js shadcn admin dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard), substantially adapted for MarketPilot. The source dashboard's MIT notice is retained at `apps/web/LICENSE`; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The repository contains a Next.js app in `apps/web`, a NestJS REST API in `apps/api`, a controlled RSS ingestion worker in `apps/worker`, and shared packages for the database, market-data providers and calculations, and news source parsing. The Desktop MarketFeed repository is an inspection reference only; MarketPilot does not call or depend on it. AI, Telegram, and Discord are not connected.

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

Developer API keys provide scoped read access to market data, sourced news, watchlists and alert rules. The Usage page counts API-key requests only; browser traffic is visible separately in Administration. The in-app API guide lists supported endpoints and request examples.

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

The navbar bell and `/dashboard/notifications` use a real personal inbox with unread counts, filters, pagination, read/unread, archive/restore and related-page shortcuts. Administrators manage reviewed announcements at `/dashboard/admin/notifications`; publishing respects account preferences and provides aggregate delivery/read counts. Security and registration notices are generated from current events. Email, bot, device-push and market-alert delivery remain unavailable. See [notification center](docs/notification-center.md).
