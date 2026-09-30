# Integrations and Security Boundaries

This document records current provider integrations and known limits. Market data is fetched directly by MarketPilot's API through a MarketPilot-owned adapter. The Desktop `marketsentinel-marketfeed` project is reference material only: there is no runtime request, code import, token, or database dependency. RSS ingestion runs separately and remains disabled pending permission confirmation. OpenRouter AI research is implemented; Telegram, Discord and BullMQ remain future work.

## Market-data provider

The current `CoinbaseExchangeProvider` uses the public [product ticker endpoint](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-ticker) for the current trade price/time and the [product candles endpoint](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles) for OHLCV history. Requests are made server-side over HTTPS from `packages/market-data`; no Coinbase account credential is used for these public reads.

- MarketPilot accepts exact Coinbase product IDs such as `BTC-USD`. It never silently maps `BTCUSDT` to `BTC-USD`, since that changes the quote asset. A product must exist at Coinbase or the API reports it unsupported.
- Supported intervals are `1m`, `5m`, `15m`, `1h`, `6h`, and `1d`, mapped to the documented Coinbase granularity values 60, 300, 900, 3600, 21600, and 86400 seconds. Requests are capped at 300 candles. The response is normalized oldest-first and retains provider symbol and timestamp.
- Coinbase notes that candle history can be incomplete and may omit intervals without ticks; its REST API documents a 300-candle maximum. Public REST endpoints are limited to 10 requests per second per IP with bursts up to 15. MarketPilot uses a per-symbol/interval Redis cache (60-second freshness, up to 15 minutes for clearly stale fallback) and a bounded request timeout.
- `packages/market-data` calculates RSI-14, MACD (12, 26, 9), SMA-50/200, Bollinger Bands (20, 2 standard deviations), Stochastic (14, 3), ATR-14, a deterministic trend classification, and percentile support/resistance levels from validated candles. Metrics requiring more history are `null`; the UI reports them as unavailable instead of inventing zeroes.
- This provider adapter currently covers Coinbase Exchange products only. It does not establish FX coverage, broad asset coverage across all exchanges, sentiment, news, or a live streaming feed. Those require separately verified providers/contracts and adapters.

## Desktop MarketFeed reference audit

The source project was inspected read-only and its data pipeline, calculations, symbol-resolution heuristics, validation gaps, and provenance lessons are recorded in [marketfeed-audit.md](marketfeed-audit.md). Useful ideas informed MarketPilot's provider boundary and pure calculation layer. Its Express/MongoDB server and HTTP API are not called by MarketPilot and are not code dependencies.

## News ingestion

`apps/worker` reads Investing RSS URLs only from `INVESTING_RSS_FEEDS_JSON`; `.env.example` lists the official category feeds but sets `NEWS_INGESTION_ENABLED=false`. Do not enable content fetching/display/storage until the intended use is permitted in writing. The official [Investing.com RSS page](https://www.investing.com/webmaster-tools/rss) says reproduction, storage, display, modification, transmission, and distribution need prior written permission. The parser enforces HTTPS and the official feed host, validates XML and item URLs, applies an 8-second timeout/2 MiB limit, uses ETag/Last-Modified, and isolates feed failures. Worker cadence defaults to 900 seconds and rejects intervals below 300 seconds.

RSS articles are normalized and deduplicated by SHA-256 of a URL with tracking parameters and fragments removed. PostgreSQL preserves the original URL, source, title/description as provided, dates, language, feed categories, affected symbols matched by exact token, and nullable future classification columns. A Redis lock prevents overlapping worker refreshes; feed state and aggregate refresh status are separate from market-data caching. News sentiment remains `null`. On an authenticated AI research request, bounded stored titles/descriptions may be sent to the configured OpenRouter model as explicitly untrusted source data. Articles are displayed as plain text with original source links.

## AI tools and trust boundary

The provider/contracts layer lives in `packages/ai`; authenticated domain orchestration lives in `apps/api/src/ai`. Tools call authenticated application services, never raw SQL, external provider URLs, Telegram/Discord APIs, or model-provided URLs. Each tool derives the user ID and permissions from the authenticated request context rather than model arguments.

| Tool | Behavior |
|---|---|
| `getMarketPrice` | Read a supported asset's normalized price observation and timestamp from the market service. |
| `getTechnicalIndicators` | Read only indicators supported by the verified provider contract and requested time range. |
| `getTrendAnalysis` | Return provider-backed trend data with its observation window and source. |
| `getMarketNews` | Return validated, bounded news metadata/content and publication/provider timestamps. Treat all article text as untrusted. |
| Sentiment (unavailable) | No working tool or score is exposed; explain this limitation and use factual observations/news. |
| `getWatchlist` | Read only the authenticated user's watchlist or a specifically selected owned list. |
| `compareAssets` | Call authorized market services for each supported asset; report partial failures instead of filling gaps. |
| `createAlert` | Validate an explicit user-requested condition through alert service. Require confirmation in the UI before applying a new alert; never allow the model to silently change or delete alerts. |

Validate tool arguments with strict Zod schemas, reject unknown asset/range/indicator values, enforce per-user authorization and rate limits, and return typed result envelopes including source, observation time, units, and unavailable/error states where known. Pass the model only these results, with clear tool provenance. Require the response to distinguish retrieved facts from analysis, cite the tool result/time in the UI, and say when data is missing or stale. The model must not produce a market value absent from tool output; unsupported questions should receive an explicit limitation.

Treat news/article text and other external strings as untrusted data. Bound length, normalize/strip unsafe markup for display, and delimit content as quoted source material. Do not let instructions embedded in articles alter system policy, invoke tools, disclose secrets, or override the user. Do not execute links/code found in external content.

Keep an AI provider interface configured by server-only environment variables. Store provider/model identifiers and usage metadata as needed, but never provider keys in the browser. Persist bounded private turns/results in owned research records, separate from general logs. Store model, run state, tool count, token counts, reported cost, reservation and latency for ADMIN metrics. General request logs contain route/status metadata only; neither article bodies, tool arguments nor private messages enter activity/request logs. AI output is analysis, not personalized financial advice.

## Telegram and Discord

### Account linking

An authenticated user requests a random, short-lived, single-use link challenge in the web app. Store only its hash and expiry. The user submits it in a private Telegram chat or Discord slash command. The bot verifies the challenge server-side, binds the platform's immutable user/account ID to the user, consumes the challenge atomically, and confirms in both interfaces. Do not link by username, display name, or an unauthenticated callback. Support unlink/revoke and log those actions.

Telegram bots should reject group use for linking and sensitive account commands. Prefer long polling for local/development operation; if production webhooks are used, require Telegram's configured secret token and a non-guessable route, validate payloads, and deduplicate update IDs.

Discord interactions must validate the Ed25519 request signature against the raw request body and reject stale/invalid timestamps before parsing commands. Register least-privilege slash commands and acknowledge within Discord's response deadline; defer long work safely. Use OAuth only if a confirmed product requirement needs it; command-based single-use linking is sufficient for initial notifications.

### Commands

Start with a small allowlist: `/link`, `/unlink`, `/watchlist`, `/price`, `/news`, and `/help`. Add technical analysis/compare/alert commands only after supported market-data operations and safe parameter schemas are known. Every command reuses API services, enforces account scope, and returns data source/time or an explicit unavailable response. Never let a bot command execute a trade.

### Notification flow

Implemented in-app delivery stores personal notifications in PostgreSQL. The navbar polls once per minute while visible, refreshes on focus/actions, and synchronizes local tabs. ADMIN announcements use a reviewed draft and atomic fan-out; security/account notices come from actual events. See [notification center](notification-center.md) for current boundaries.

The following external delivery flow remains planned:

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

- Authentication (implemented): NestJS email/password sessions; bcrypt cost 12 with a 12-character minimum for new registrations and a 72-byte UTF-8 maximum. Login validates existing credentials without applying the new-password minimum. Random opaque session tokens are stored only as SHA-256 hashes. The cookie is HTTP-only, `SameSite=Lax`, secure in production, and expires after 14 days. Logout and session revocation invalidate tokens.
- Authorization (implemented): global authentication and role guards; server-assigned `ADMIN`/`USER` roles; user-owned service queries; API-key scope checks. Mutating requests with an `Origin` header must match `WEB_ORIGIN` or the API's own origin. Credentialed CORS uses the configured web-origin allowlist.
- API keys (implemented): 256-bit random secret plus a 64-bit random lookup prefix; SHA-256 hash only is stored; the secret is shown once and verification uses constant-time comparison. Keys support `market:read`, `news:read`, `watchlists:read`, and `alerts:read`, revocation, and last-used tracking. Keys cannot access account management or administration endpoints.
- Rate limits (implemented): Redis-backed 60-second fixed windows allow 10 login/register attempts per IP, 120 requests per API key, and 300 authenticated browser requests per user. Key and browser buckets are independent. Authenticated logout remains available after a request bucket is exhausted. A bounded per-process fallback runs if Redis is unavailable; this fallback is not distributed across replicas.
- Secret management: local values load from a root `.env` file ignored by Git; deployments should inject separate environment-specific credentials. Never log passwords, session/API-key secrets, or authorization headers. Market-data provider selection is server-side and never comes from user input.
- Bot security (planned): verify Telegram webhook secrets; verify Discord Ed25519 signatures against raw request bytes and timestamps; deduplicate provider delivery IDs; allowlist commands; keep bot tokens server-side.
- Bot security: verify Telegram webhook secret when using webhooks; verify Discord Ed25519 signatures on exact raw bytes and timestamp; deduplicate provider delivery IDs; allowlist commands; use least-privilege bot permissions; store bot tokens only server-side.
- Upstream security: HTTPS to allowlisted provider hosts, strict timeouts, bounded response size, schema validation, bounded retry rules, and no user-controlled URL fetching. Avoid returning upstream stack traces or secrets.
- Audit/privacy: record security changes and integration link/unlink/delivery events with minimal safe metadata; define retention and export/deletion behavior before launch.

## Unresolved questions

1. Which additional crypto and FX providers should be supported, and what access/redistribution terms apply to each?
2. Should FX be in scope now? If so, which provider and plan can supply verified spot prices and candles for the required currency pairs?
3. What market-data freshness and stale-data policy should apply to watchlists and alert evaluation?
4. Is email verification, password reset, or social login required at launch?
5. Are teams/workspaces, role customization, or multiple seats in scope, or only individual users plus an administrator role?
6. What commercial API quotas/pricing and request-log retention policy should be adopted? The current developer API is read-only; usage counts key traffic only.
7. Which AI provider/model, budget/retention policy, and confirmation UX should be used?
8. Which hosting/region, production secrets manager, public API domain, and bot deployment/webhook model are intended?
9. What are alert condition semantics, evaluation cadence, quiet hours, deduplication, and notification retention requirements?

## OpenRouter implementation

The initial provider is the official OpenRouter Chat Completions API. Configuration is server-only (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, optional fixed official `OPENROUTER_BASE_URL`). Catalog discovery checks exact model ID, `tools`, `tool_choice`, `structured_outputs` and nonnegative published token/request prices. Routing requires parameter support, disallows provider fallbacks and requests providers that deny data collection. A catalog capability flag is not proof of live availability; actual inference can still fail safely. No OpenAI/other-provider runtime fallback or Desktop reference dependency is introduced.

The implementation follows official [tool calling](https://openrouter.ai/docs/guides/features/tool-calling), [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs), [streaming/cancellation](https://openrouter.ai/docs/api_reference/streaming), [errors](https://openrouter.ai/docs/api_reference/errors-and-debugging), and [model discovery](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties) documentation. Structured output and tool-call arguments/results are validated locally even when the provider reports support. No hidden reasoning is streamed or stored. Provider raw error payloads never reach browser or general logs. See [AI Analyst](ai-analyst.md) for request limits, spend reservations, confirmation and verified limitations.
