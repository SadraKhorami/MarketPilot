# MarketPilot

**AI-powered market intelligence**

MarketPilot is a market intelligence dashboard for monitoring assets, trends, news, sentiment, alerts, and integrations. The current phase builds the frontend foundation only. Values shown in the UI are clearly labeled local fixtures; they are not live market observations and do not come from an AI provider.

## Frontend

The web app is based on the completed [Next.js shadcn admin dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard), substantially adapted for MarketPilot. The source dashboard's MIT notice is retained at `apps/web/LICENSE`; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Run locally

Requirements: Node.js 22 and pnpm 10.26 or compatible versions.

```bash
pnpm install
pnpm dev
```

The dashboard opens at `http://localhost:3000`. This frontend preview does not connect to backend, MarketFeed, AI, Telegram, Discord, or API-key services.

## Workspace commands

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm ci
```

GitHub Actions runs the same checks on pull requests and pushes to `main`.

## Project docs

- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Database proposal](docs/database.md)
- [Integration and security design](docs/integrations.md)
- [MarketFeed source audit](docs/marketfeed-audit.md)
