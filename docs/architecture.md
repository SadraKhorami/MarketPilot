# MarketPilot Architecture

## Baseline and principles

Use the supplied `arhamkhnz/next-shadcn-admin-dashboard` repository as the frontend starting point. The inspected snapshot is commit `7eedd77` on 2026-09-29. Its Next.js 16 / React / TypeScript / Tailwind CSS v4 / shadcn foundation, dashboard shell, theme preferences, charting, table, and form patterns are useful. It is currently a single npm app with many unrelated demo routes and static data, not a SaaS backend. Adapt it deliberately; retain its `LICENSE` and add `THIRD_PARTY_NOTICES.md` with attribution. The upstream license is MIT.

Prioritize a small, clear monorepo with explicit boundaries. The proposed tools are pnpm workspaces and Turborepo, subject to Phase 1 validation against the source app's current setup. Strict TypeScript and Zod validation are required at external and cross-service boundaries. No MarketFeed path, field, or behavior is assumed in this proposal.

## Proposed repository

```text
apps/
  web/       Next.js dashboard, server-rendered UI, browser-facing experience
  api/       NestJS REST API, auth, authorization, product use cases, OpenAPI
  worker/    BullMQ consumers and scheduled jobs
  bot/       Telegram and Discord adapters/commands; no duplicated domain rules
packages/
  db/        Prisma schema/client/migrations and database helpers
  marketfeed/ Typed provider contract, contract validation, real and dev mock adapters
  ai/        Provider abstraction, tool schemas, orchestration and policy prompts
  types/     Stable shared domain/API types that do not import application internals
  config/    Shared lint/TypeScript/runtime-safe configuration
```

### Responsibilities and dependency direction

- `apps/web` calls the MarketPilot API; it does not call MarketFeed or hold provider/model/bot credentials. Use the dashboard's existing shell and semantic theme system as the base, replacing routes and static product data incrementally.
- `apps/api` owns user identity, authorization, business rules, validation, rate limits, REST endpoints, OpenAPI, and orchestration of market/AI/alert services. It exposes MarketPilot contracts, never raw vendor contracts.
- `apps/worker` runs isolated BullMQ processors. It invokes application services and writes durable job outcomes; it does not become a second source of domain rules.
- `apps/bot` authenticates Telegram/Discord updates and translates commands/notifications into API or shared application-service calls. It has no direct DB access except through a deliberately shared service boundary if later justified.
- `packages/db` is the only package that owns Prisma schema and database client construction. API and worker may consume it through services; web and bot do not access it.
- `packages/marketfeed` isolates the unknown vendor contract. Its typed interface is based only on confirmed capabilities; the development mock implements that interface and is selected explicitly by configuration.
- `packages/ai` receives scoped application tools and provider configuration. It does not own authentication or call vendor APIs directly.
- `packages/types` contains stable shared value types only; avoid turning it into a dumping ground or creating circular imports.
- `packages/config` holds shared build/lint configuration, not secrets or runtime credentials.

Dependency flow: web/bot -> API; API/worker -> application services -> db and MarketFeed; AI orchestration -> application tools -> services. Avoid direct coupling from UI or AI provider code to Prisma or MarketFeed response shapes.

## API boundaries

NestJS serves a versioned REST API (initial prefix proposal: `/api/v1`) and publishes OpenAPI. These are MarketPilot-owned routes, not claims about MarketFeed endpoints.

- Identity/session: register, login, logout, current-user, session revocation.
- Market read: price, indicators, trend, news, sentiment, and asset comparison only after the MarketFeed contract confirms the required operations and shapes.
- Personal data: watchlists and items, alerts, notification-channel linking, API keys, usage, activity, and AI conversations/tool calls.
- Operations: liveness/readiness health endpoints with no secret or infrastructure details in public responses.

Validate path/query/body input in NestJS. Normalize errors into a stable envelope with a request ID; map upstream timeouts, authentication failures, rate limits, and invalid upstream responses without leaking credentials or vendor payloads. Add pagination only after product/API semantics are defined. Browser clients authenticate to MarketPilot, never with the MarketFeed token.

## Runtime and data flow

PostgreSQL is the source of truth. Redis supports cache/rate-limit coordination and BullMQ. The API validates a user request and authorization, calls a domain service, and returns a normalized result with provider and observation time where available. Workers refresh only contract-supported market resources, evaluate enabled alerts against validated observations, and enqueue notifications. An outbox record bridges database commits to queue publishing so a committed alert/notification intent is not silently lost.

Use per-request timeouts, bounded retries for retryable upstream failures, and circuit-breaking/backoff for repeated provider failures. Do not retry invalid input or authentication failures. Cache keys must include the normalized asset/query dimensions and contract-compatible time range; TTLs remain a configuration decision until MarketFeed freshness/rate limits are known.

## Source dashboard reuse

Preserve the dashboard shell, sidebar/layout controls, theme preferences and CSS tokens, local shadcn primitives, chart wrappers/Recharts patterns, TanStack Table patterns, RHF/Zod patterns, and useful responsive behaviors. Remove the Studio Admin landing page, unrelated CRM/e-commerce/healthcare/logistics/task/mail sample routes, fake users/data, template account switcher, fake auth behavior, and template-specific links when replaced. Keep upstream UI primitives intact where their repository guidance requires it. No implementation is authorized by this document; the source audit is recorded in the Phase 0 summary.

## CI and release

Use GitHub Actions for pull-request and main-branch CI. The initial workflow should install the locked pnpm toolchain, use the pnpm cache, then run formatting/lint, type checks, relevant tests, and production builds through workspace filters. Add PostgreSQL/Redis service containers only when checks require them. Do not publish, deploy, or expose secrets from untrusted pull-request workflows. Workflow implementation belongs with repository bootstrap and will be reviewed separately.

## Operational requirements

Structured logs carry request/job IDs and user IDs only where appropriate; never log passwords, session/API-key secrets, bot tokens, or raw authorization headers. Health checks distinguish process liveness from dependency readiness. Metrics should cover provider errors/latency, queue depth/age, alert evaluation, notification delivery, and API latency without high-cardinality personal data.
