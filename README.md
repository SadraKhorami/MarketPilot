# MarketPilot

**AI-powered market intelligence**

MarketPilot is a market intelligence SaaS for monitoring assets, trends, news, sentiment, alerts, and integrations. The UI is connected to a NestJS API for authentication and account data. Market observations, AI analysis, and bot integrations remain fixture-only or disconnected; they are not presented as live provider results.

## Workspace

The web app is based on the completed [Next.js shadcn admin dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard), substantially adapted for MarketPilot. The source dashboard's MIT notice is retained at `apps/web/LICENSE`; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The repository contains a Next.js app in `apps/web`, a NestJS REST API in `apps/api`, and shared Prisma schema/client tooling in `packages/db`. MarketFeed, AI, Telegram, and Discord integrations are not connected.

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

## Workspace commands

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm ci
```

Tests use mocked persistence for deterministic auth, authorization, watchlist, alert, and API-key coverage. GitHub Actions starts PostgreSQL and Redis, applies the checked-in Prisma migration, and runs the same checks.

GitHub Actions runs the same checks on pull requests and pushes to `main`.

## Project docs

- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Database proposal](docs/database.md)
- [Integration and security design](docs/integrations.md)
- [MarketFeed source audit](docs/marketfeed-audit.md)
