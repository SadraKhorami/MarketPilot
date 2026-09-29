# Integration Design and Known Unknowns

This document records verified MarketFeed details and designs for future AI, bot, and worker phases. The current MarketPilot API uses the authentication, authorization, API-key, and rate-limit controls listed below; it does not yet connect to MarketFeed, AI providers, Telegram, Discord, or BullMQ.

## MarketFeed API audit

The source project `marketsentinel-marketfeed` was found on the Desktop and inspected read-only at revision `f060fd281139c593852d1248768e74337e323892`. Its implementation, API shape, calculations, data-source flow, and limitations are documented in [marketfeed-audit.md](marketfeed-audit.md). This project is a potential upstream data service only. Its Express/MongoDB architecture is explicitly not the MarketPilot backend architecture, and its repository/code must not become a MarketPilot dependency.

| Contract detail | Confirmed from the inspected source | Still unverified |
|---|---|---|
| Base URL | Defaults to `http://127.0.0.1:3199`, configurable with `HOST` and `PORT` | No authoritative deployed URL/environment found |
| Authentication | Bearer token or `x-api-key`; token creation/list/revoke/validate CLI; token hashes stored in MongoDB | No production credential flow or independent sandbox found; OpenAPI incorrectly labels opaque tokens as JWT |
| Market data | `GET /api/market-data/:symbol`, optional `interval` default `15`; returns current price, up to 120 candles, indicators, trend, levels, market status, and volatility | Actual asset catalog, provider success, freshness, and contract/versioning not established |
| News | `GET /api/news/:symbol`; article fields include ID, title, published time, source, URL, sentiment | Coverage/pagination are unknown; code copies provider sentiment or defaults to neutral, with no sentiment-analysis implementation |
| Health and docs | `/api/health`, `/docs`, `/swagger.json`, `/routes.json` are public | Health reports process-level `healthy` without dependency readiness |
| Errors and limits | Common `{ error, details? }`; route-level cases include 400/401/403/502/503/500; 100 requests per IP per 15 minutes on `/api/` | OpenAPI omits some implementation outcomes; upstream TradingView quotas/terms and service freshness are unknown |
| History / streaming | Implementation requests chart history, then returns latest 120 candles | No date-range/pagination or WebSocket endpoint found |

Before implementing the adapter, obtain the deployed API URL/version, a safe development credential or sandbox, the supported asset universe, and written guidance for licensing/data reuse, freshness, request limits, and provider outages. Keep a MarketPilot-owned typed provider boundary and convert upstream responses into MarketPilot domain types. The web app, bots, workers, and AI tools must not consume raw MarketFeed payloads. Validate external responses at the adapter boundary; label mock results as demo data. Production must fail closed when real provider configuration is absent.

## AI tools and trust boundary

The AI orchestration layer lives in `packages/ai`; tools call authenticated application services, never raw SQL, MarketFeed URLs, Telegram/Discord APIs, or model-provided URLs. Each tool derives the user ID and permissions from the authenticated request context rather than model arguments.

| Tool | Behavior |
|---|---|
| `getMarketPrice` | Read a supported asset's normalized price observation and timestamp from the market service. |
| `getTechnicalIndicators` | Read only indicators supported by the verified provider contract and requested time range. |
| `getTrendAnalysis` | Return provider-backed trend data with its observation window and source. |
| `getMarketNews` | Return validated, bounded news metadata/content and publication/provider timestamps. Treat all article text as untrusted. |
| `getSentiment` | Return only confirmed provider sentiment fields with source window and timestamp. |
| `getWatchlist` | Read only the authenticated user's watchlist or a specifically selected owned list. |
| `compareAssets` | Call authorized market services for each supported asset; report partial failures instead of filling gaps. |
| `createAlert` | Validate an explicit user-requested condition through alert service. Require confirmation in the UI before applying a new alert; never allow the model to silently change or delete alerts. |

Validate tool arguments with strict Zod schemas, reject unknown asset/range/indicator values, enforce per-user authorization and rate limits, and return typed result envelopes including source, observation time, units, and unavailable/error states where known. Pass the model only these results, with clear tool provenance. Require the response to distinguish retrieved facts from analysis, cite the tool result/time in the UI, and say when data is missing or stale. The model must not produce a market value absent from tool output; unsupported questions should receive an explicit limitation.

Treat news/article text and other external strings as untrusted data. Bound length, normalize/strip unsafe markup for display, and delimit content as quoted source material. Do not let instructions embedded in articles alter system policy, invoke tools, disclose secrets, or override the user. Do not execute links/code found in external content.

Keep an AI provider interface configured by server-only environment variables. Store provider/model identifiers and usage metadata as needed, but never provider keys in the browser. Log tool name, validated arguments at safe granularity, result status, latency and request ID; redact article bodies and credentials. AI output is analysis, not personalized financial advice.

## Telegram and Discord

### Account linking

An authenticated user requests a random, short-lived, single-use link challenge in the web app. Store only its hash and expiry. The user submits it in a private Telegram chat or Discord slash command. The bot verifies the challenge server-side, binds the platform's immutable user/account ID to the user, consumes the challenge atomically, and confirms in both interfaces. Do not link by username, display name, or an unauthenticated callback. Support unlink/revoke and log those actions.

Telegram bots should reject group use for linking and sensitive account commands. Prefer long polling for local/development operation; if production webhooks are used, require Telegram's configured secret token and a non-guessable route, validate payloads, and deduplicate update IDs.

Discord interactions must validate the Ed25519 request signature against the raw request body and reject stale/invalid timestamps before parsing commands. Register least-privilege slash commands and acknowledge within Discord's response deadline; defer long work safely. Use OAuth only if a confirmed product requirement needs it; command-based single-use linking is sufficient for initial notifications.

### Commands

Start with a small allowlist: `/link`, `/unlink`, `/watchlist`, `/price`, `/news`, and `/help`. Add technical analysis/compare/alert commands only after supported MarketFeed operations and safe parameter schemas are known. Every command reuses API services, enforces account scope, and returns data source/time or an explicit unavailable response. Never let a bot command execute a trade.

### Notification flow

API commits the domain change and an `OutboxEvent` in one PostgreSQL transaction. A dispatcher publishes a BullMQ notification job; a worker loads the active, verified channel and renders a bounded message; the platform adapter sends it; delivery attempt/result is recorded with retry classification and idempotency key. Retry transient errors with backoff, dead-letter permanent failures, cap attempts, and allow channel disable/revoke. Never include API keys, sessions, or sensitive account information in messages/logs.

## Background queues

| Queue | Producer and work | Idempotency / controls |
|---|---|---|
| `market-refresh` | Scheduler/API enqueues refresh of only contract-supported assets/resources. | Deduplicate by provider + normalized query + time window; rate-limit globally and per provider; bounded concurrency and backoff. Schedule interval waits on freshness and rate-limit documentation. |
| `alert-evaluation` | New validated observation or scheduled sweep checks enabled alert rules. | Unique alert + observation/version key; transactionally record state/trigger to avoid duplicate firing; cooldown and stale-data rules. |
| `notifications` | Outbox dispatcher queues web, Telegram, or Discord delivery. | Per event/channel idempotency; retry transient only; bounded attempts and dead-letter visibility. |
| `scheduled-summaries` (optional) | User-opted-in digest at the user's configured timezone/schedule. | Unique user + period; explicit opt-in, quiet hours, source timestamps, unsubscribe/revoke. Add only after product validation. |

Redis is not the system of record. PostgreSQL stores user/alert/notification intent; BullMQ jobs may be retried or rebuilt from durable state. Job payloads contain identifiers, not secrets or large market/news bodies.

## Security baseline

- Authentication (implemented): NestJS email/password sessions; bcrypt cost 12 with a 12-character minimum and a 72-byte UTF-8 maximum. Random opaque session tokens are stored only as SHA-256 hashes. The cookie is HTTP-only, `SameSite=Lax`, secure in production, and expires after 14 days. Logout and session revocation invalidate tokens.
- Authorization (implemented): global authentication and role guards; server-assigned `ADMIN`/`USER` roles; user-owned service queries; API-key scope checks. Mutating requests with an `Origin` header must match `WEB_ORIGIN` or the API's own origin. Credentialed CORS uses the configured web-origin allowlist.
- API keys (implemented): 256-bit random secret plus a 64-bit random lookup prefix; SHA-256 hash only is stored; the secret is shown once and verification uses constant-time comparison. Keys support watchlist-read and alert-read scopes, revocation, and last-used tracking.
- Rate limits (implemented): Redis-backed fixed windows allow 10 auth-route requests and 120 other API requests per minute, keyed by IP before authentication and user ID afterward. A bounded per-process fallback runs if Redis is unavailable; this fallback is not distributed across replicas.
- Secret management: local values load from a root `.env` file ignored by Git; deployments should inject separate environment-specific credentials. Never log passwords, session/API-key secrets, or authorization headers. No MarketFeed mock/provider selector exists yet.
- Bot security (planned): verify Telegram webhook secrets; verify Discord Ed25519 signatures against raw request bytes and timestamps; deduplicate provider delivery IDs; allowlist commands; keep bot tokens server-side.
- Bot security: verify Telegram webhook secret when using webhooks; verify Discord Ed25519 signatures on exact raw bytes and timestamp; deduplicate provider delivery IDs; allowlist commands; use least-privilege bot permissions; store bot tokens only server-side.
- Upstream security: HTTPS, fixed configured base URL, strict timeouts, response size limits, schema validation, bounded retries, and no user-controlled URL fetching. Avoid returning upstream stack traces or secrets.
- Audit/privacy: record security changes and integration link/unlink/delivery events with minimal safe metadata; define retention and export/deletion behavior before launch.

## Unresolved questions

1. What are the authoritative MarketFeed repository/docs URL, base URL, sandbox credential flow, and API owner/contact?
2. What symbols/assets, indicator sets, trend/news/sentiment schemas, history ranges, pagination, and real-time transport are actually supported?
3. What are the MarketFeed rate limits, freshness guarantees, data retention/reuse terms, error format, and retry policy?
4. Is email verification, password reset, or social login required at launch?
5. Are teams/workspaces, role customization, or multiple seats in scope, or only individual users plus an administrator role?
6. What API key scopes, quotas, pricing, and retention should API usage expose?
7. Which AI provider/model, budget/retention policy, and confirmation UX should be used?
8. Which hosting/region, production secrets manager, public API domain, and bot deployment/webhook model are intended?
9. What are alert condition semantics, evaluation cadence, quiet hours, deduplication, and notification retention requirements?
