# Integration Design and Known Unknowns

## MarketFeed API audit

The supplied project workspace had no MarketFeed repository, API URL, OpenAPI/Swagger document, or endpoint definitions. The dashboard foundation also contains no MarketFeed integration. The product brief says the service provides current/real-time prices, technical indicators, trend analysis, news, sentiment, and token-based authentication. It does not specify how any of these are requested or returned.

| Contract detail | Discovery result |
|---|---|
| Base URL / environments | Not supplied or discoverable locally |
| Token transport, acquisition, expiry/refresh | Token-based authentication is stated; header/query format and lifecycle are unknown |
| Endpoint paths and HTTP methods | Unknown; do not invent |
| Request parameters and supported symbols/assets | Unknown |
| Price, indicator, trend, news, and sentiment response schemas | Capabilities are stated; fields/enums/units are unknown |
| Pagination and time-range semantics | Unknown |
| Error schema and retry hints | Unknown |
| Rate limits, quotas, freshness guarantees | Unknown |
| Websocket/stream protocol for “real-time” | Unknown; real-time may mean polling or streaming |

Before implementing the real adapter, obtain the authoritative API URL and docs/spec or source repository, a development credential or safe sandbox, supported asset universe, and provider guidance for rate limits and data reuse. Until then, keep a typed `MarketFeedProvider` boundary based only on confirmed product capabilities and build a deterministic development mock behind explicit environment selection. Validate all mock/real responses at the adapter boundary; label mock results as demo data. Production must fail closed when real provider configuration is absent.

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

- Authentication: NestJS-owned email/password sessions; hash passwords with Argon2id using a maintained library and current parameters. Use random opaque session tokens, store only token hashes, and set cookies `HttpOnly`, `Secure` in production, `SameSite=Lax` (or stricter if flow permits), scoped path, and bounded lifetime. Rotate on login/privilege changes; revoke on logout/password reset. Enforce CSRF protection for cookie-authenticated mutations and origin checks.
- Authorization: default-deny NestJS guards, ownership checks in domain services/queries, and database relations scoped by `userId`. Use server-assigned roles and least privilege; admin actions audited. Do not trust hidden UI navigation as authorization.
- API keys: reveal high-entropy secrets once; store only an HMAC/hash with a server-side pepper in secret management, keep a non-secret lookup prefix, scopes, expiry/revocation, and last-used metadata. Constant-time verify; rate-limit and audit issuance/revocation/use.
- Rate limits: protect login, password reset, API key auth, AI usage, and public/bot callbacks by account and source. Use Redis-backed distributed limits with safe fallback behavior; do not return detailed account-existence information.
- Secret management: environment injection or deployment secret manager; separate dev/test/prod credentials; rotation plan; never commit `.env`, log credentials, or expose server variables through Next public env prefixes. Mock mode must be explicit and disabled in production.
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
