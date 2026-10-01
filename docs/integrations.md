# Integrations and Security Boundaries

This document records current provider integrations and known limits. Market data is fetched directly by MarketPilot's API through a MarketPilot-owned adapter. The Desktop `marketsentinel-marketfeed` project is reference material only: there is no runtime request, code import, token, or database dependency. RSS ingestion runs separately and remains disabled pending permission confirmation. OpenRouter AI research and BullMQ alerts are implemented. Telegram and Discord share secure linking, private commands and independent external delivery; see [bot integrations](bot-integrations.md) for required credentials, HTTPS webhooks and delivery limits.

## Market-data provider

The current `CoinbaseExchangeProvider` uses the public [product ticker endpoint](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-ticker) for the current trade price/time and the [product candles endpoint](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles) for OHLCV history. Requests are made server-side over HTTPS from `packages/market-data`; no Coinbase account credential is used for these public reads.

- MarketPilot accepts exact Coinbase product IDs such as `BTC-USD`. It never silently maps `BTCUSDT` to `BTC-USD`, since that changes the quote asset. A product must exist at Coinbase or the API reports it unsupported.
- Supported intervals are `1m`, `5m`, `15m`, `1h`, `6h`, and `1d`, mapped to the documented Coinbase granularity values 60, 300, 900, 3600, 21600, and 86400 seconds. Requests are capped at 300 candles. The response is normalized oldest-first and retains provider symbol and timestamp.
- Coinbase notes that candle history can be incomplete and may omit intervals without ticks; its REST API documents a 300-candle maximum. Public REST endpoints are limited to 10 requests per second per IP with bursts up to 15. MarketPilot uses a per-symbol/interval Redis cache (60-second freshness, up to 15 minutes for clearly stale fallback) and a bounded request timeout.
- `packages/market-data` calculates RSI-14, MACD (12, 26, 9), SMA-50/200, Bollinger Bands (20, 2 standard deviations), Stochastic (14, 3), ATR-14, a deterministic trend classification, and percentile support/resistance levels from validated candles. Metrics requiring more history are `null`; the UI reports them as unavailable instead of inventing zeroes.
- `/market-data/catalog` discovers active products and readable currency names from Coinbase's public products/currencies endpoints, caching discovery for ten minutes. Dropdowns search this catalog; the eight dashboard cards remain featured markets, rather than the complete selection.
- A separate server-only adapter uses [`@mathieuc/tradingview`](https://github.com/Mathieu2301/TradingView-API) anonymous chart sessions for the reference multi-asset catalog. It requires no Twelve Data API key. Gold/silver and seven major FX pairs resolve to explicit OANDA symbols; AAPL, MSFT, NVDA and TSLA resolve to explicit NASDAQ symbols. Availability in the catalog means the instrument has a configured route; actual upstream access is validated on each read.
- TradingView requests up to 300 candles at 1m, 5m, 15m, 1h, 6h or 1d with a thirteen-second request deadline and at most three concurrent chart requests. Identical in-flight requests are shared. Each read deletes its chart and closes its WebSocket. Candle values, resolved instrument and quote currency are validated. The returned price is explicitly a candle close; missing volume and unknown market-open status remain null. Source-specific Redis keys separate observations. This is a bounded reference catalog, not discovery of every global stock or FX instrument.
- TradingView is an unofficial library connection; anonymous data access, exchange delays and provider availability can differ by market. Upstream failures are shown as unavailable or clearly labeled cached observations. No account credentials, fabricated data or silent quote-currency substitution are used. The browser imports shared types/catalog utilities only; the Node/WebSocket adapter is exported through the server-only `@marketpilot/market-data/providers` entry point.


## Desktop MarketFeed reference audit

The source project was inspected read-only and its data pipeline, calculations, symbol-resolution heuristics, validation gaps, and provenance lessons are recorded in [marketfeed-audit.md](marketfeed-audit.md). Useful ideas informed MarketPilot's provider boundary and pure calculation layer. Its Express/MongoDB server and HTTP API are not called by MarketPilot and are not code dependencies.

## News ingestion

`apps/worker` reads Investing RSS URLs only from `INVESTING_RSS_FEEDS_JSON`; `.env.example` lists the official category feeds but sets `NEWS_INGESTION_ENABLED=false`. Do not enable content fetching/display/storage until the intended use is permitted in writing. The official [Investing.com RSS page](https://www.investing.com/webmaster-tools/rss) says reproduction, storage, display, modification, transmission, and distribution need prior written permission. The parser enforces HTTPS and the official feed host, validates XML and item URLs, applies an 8-second timeout/2 MiB limit, uses ETag/Last-Modified, and isolates feed failures. Worker cadence defaults to 900 seconds and rejects intervals below 300 seconds.

RSS articles are normalized and deduplicated by SHA-256 of a URL with tracking parameters and fragments removed. PostgreSQL preserves the original URL, source, title/description as provided, dates, language, feed categories, affected symbols matched by exact token, and nullable future classification columns. A Redis lock prevents overlapping worker refreshes; feed state and aggregate refresh status are separate from market-data caching. News sentiment remains `null`. The Asset filter matches stored affected-asset tags or case-insensitive title/description keywords (base ticker, known aliases and catalog name). Free-text search narrows these matches independently and can also match the article source. This is coverage matching, not a claim that an article financially affects the asset. The reading list uses the same keyword semantics. On an authenticated AI research request, bounded stored titles/descriptions may be sent to the configured OpenRouter model as explicitly untrusted source data. Articles are displayed as plain text with original source links.

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

Both providers are implemented through the server-only `packages/bots` transport and shared Nest domain services. Linking uses a hashed cryptographic one-time token, atomic candidate redemption, browser identity confirmation and destination uniqueness. Disconnect revokes pending tokens and delivery eligibility. Telegram accepts sensitive commands only in verified private chats; Discord link commands require bot DM and other responses are ephemeral. No raw internal account IDs or credentials are requested from users.

Commands are `/start` (Telegram), `/link` (Discord), `/help`, `/price`/`/market`, `/analyze`, `/ask`, `/watchlist` and `/alerts`. Price commands use existing catalog/source validation; research uses existing AI quotas, sourced tools and browser proposal confirmation. No trades, daily summaries or fabricated sentiment are added.

HTTPS webhooks are used for both local development (through an operator-provided tunnel) and production. Telegram secret headers and Discord Ed25519 raw-body/timestamp verification authenticate ingress. Durable encrypted command records carry unique platform event IDs; BullMQ jobs carry IDs only. Discord acknowledges promptly and edits the original private response. Private destinations, current account/rule status and preferences are checked again before sending.

The Phase 5 trigger transaction adds independent `ExternalDelivery` records only for verified opted-in destinations. The external outbox, attempts, provider receipts and ambiguous acceptance status never overwrite dashboard inbox state. Telegram uncertainty stops automatic replay; Discord uses a stable recent-message nonce with bounded recovery. Exactly-once external delivery is not promised. See [bot setup, privacy and recovery](bot-integrations.md) for complete configuration, installation and operational limits.

## Background queues

| Queue | Producer and work | Idempotency / controls |
|---|---|---|
| `market-refresh` | Scheduler/API enqueues refresh of only contract-supported assets/resources. | Deduplicate by provider + normalized query + time window; rate-limit globally and per provider; bounded concurrency and backoff. Schedule interval waits on freshness and rate-limit documentation. |
| `alert-evaluation` | New validated observation or scheduled sweep checks enabled alert rules. | Unique alert + observation/version key; transactionally record state/trigger to avoid duplicate firing; cooldown and stale-data rules. |
| `notifications` | Phase 5 dashboard inbox delivery. | Unique trigger/inbox key and transactional completion; independent of external channels. |
| `external-notifications` | Independent Telegram/Discord alert outbox. | Per trigger/channel/destination uniqueness; current link/opt-in checks; durable attempt/receipt state and bounded ambiguity recovery. |
| `bot-commands` | Authenticated platform commands consumed within the API. | Unique provider event ID; encrypted short-lived records; execution lease; shared owned services and AI budget. |

Redis is not the system of record. PostgreSQL stores user/alert/notification intent; BullMQ jobs may be retried or rebuilt from durable state. Job payloads contain identifiers, not secrets or large market/news bodies.

## Security baseline

- Authentication (implemented): NestJS email/password sessions; bcrypt cost 12 with a 12-character minimum for new registrations and a 72-byte UTF-8 maximum. Login validates existing credentials without applying the new-password minimum. Random opaque session tokens are stored only as SHA-256 hashes. The cookie is HTTP-only, `SameSite=Lax`, secure in production, and expires after 14 days. Logout and session revocation invalidate tokens.
- Authorization (implemented): global authentication and role guards; server-assigned `ADMIN`/`USER` roles; user-owned service queries; API-key scope checks. Mutating requests with an `Origin` header must match `WEB_ORIGIN` or the API's own origin. Credentialed CORS uses the configured web-origin allowlist.
- API keys (implemented): 256-bit random secret plus a 64-bit random lookup prefix; SHA-256 hash only is stored; the secret is shown once and verification uses constant-time comparison. Keys support `market:read`, `news:read`, `watchlists:read`, and `alerts:read`, revocation, and last-used tracking. Keys cannot access account management or administration endpoints.
- Rate limits (implemented): Redis-backed 60-second fixed windows allow 10 login/register attempts per IP, 120 requests per API key, and 300 authenticated browser requests per user. Key and browser buckets are independent. Authenticated logout remains available after a request bucket is exhausted. A bounded per-process fallback runs if Redis is unavailable; this fallback is not distributed across replicas.
- Secret management: local values load from a root `.env` file ignored by Git; deployments should inject separate environment-specific credentials. Never log passwords, session/API-key secrets, or authorization headers. Market-data provider selection is server-side and never comes from user input.
- Bot security (implemented): authenticated webhooks, candidate plus browser-confirmed linking, unique platform IDs, encrypted command payloads, private responses, bounded retries and sanitized failures. See the bot guide for live setup requirements.
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
