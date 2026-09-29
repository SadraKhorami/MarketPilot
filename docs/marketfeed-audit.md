# MarketSentinel MarketFeed Implementation Audit

## Scope and conclusion

This is a read-only inspection of the Desktop repository at `Desktop/marketsentinel-marketfeed`, branch `main`, revision `f060fd281139c593852d1248768e74337e323892` (2026-01-03). Its working tree was clean. The source was not run and no external provider calls were made; findings below come from its implementation, configuration example, README, and checked-in OpenAPI file.

MarketFeed is a small Node.js/Express market-data service. Its useful product capability is a TradingView-backed chart/news ingestion path with locally calculated indicators, symbol candidate resolution, and token-gated HTTP endpoints. This audit is a source of data-pipeline knowledge and a possible upstream service contract. **It is not a recommendation to use this repository as MarketPilot's backend or to depend on its code, database, or architecture.** MarketPilot remains independently structured. Any later integration should sit behind a MarketPilot-owned, typed provider adapter and must be approved against provider terms and a verified deployed contract.

## Repository and runtime

- `index.js` contains the Express application, market resolver, TradingView client calls, calculations, cache, routes, startup, and shutdown behavior.
- `auth/` contains opaque API-token storage and middleware. `tools/token.js` is an operator CLI for token lifecycle management.
- `tools/openapi/swagger.json` is a checked-in OpenAPI 3.0.3 description; `GET /docs`, `/swagger.json`, and `/routes.json` expose documentation and route metadata.
- Tests use Jest, Supertest, and `mongodb-memory-server`. The integration suite constructs a separate Express app and returns fixture market responses; it does not exercise the production TradingView pipeline in `index.js`.
- Dependencies include Express 5, `@mathieuc/tradingview`, `technicalindicators`, MongoDB driver, in-memory `node-cache`, `express-rate-limit`, Winston, and Moment Timezone.
- The service defaults to `http://127.0.0.1:3199`; `PORT` and `HOST` can change that. No production deployment URL or TradingView credential is specified in `.env.example`.

## Data sources and pipeline

### Market candles and current price

The market-data route creates a `TradingView.Client` chart session using `@mathieuc/tradingview`; it requests up to 750 periods through the current epoch time at the requested interval. The service tries symbol candidates sequentially and uses the first candidate that returns candles. Each candidate attempt has a 13-second timeout. Candle times are converted from epoch seconds to ISO timestamps, invalid/non-positive closes are dropped, missing OHLC values fall back to close, missing volume becomes zero, and candles are sorted oldest-first for calculations. The response price and timestamp come from the last candle. It returns the latest 120 candles in **newest-first** order.

The code accepts a `symbol` path parameter and an `interval` query parameter, defaulting to `15`. The README/OpenAPI list `1`, `5`, `15`, `30`, `60`, `240`, `D`, `W`, and `M`, but the route does not validate this enum before passing the value to the provider. There is no date range, pagination, candle limit, or streaming/WebSocket endpoint in the implementation.

### Symbol candidate resolution

The resolver uppercases input, accepts an optional `VENDOR:PAIR` prefix, and expands common USD/USDT/USDC pair variants. Vendor aliases are `ODANA -> OANDA`, `FXPULSE -> FX_IDC`, and `FXPREMIUM -> FX_IDC`. Explicit vendor candidates are tried first. Unqualified symbols try Binance candidates first, then vendor fallbacks:

- Crypto fallback vendors: Binance, Bitstamp, Coinbase, Kraken, Bybit.
- Forex fallback vendors: OANDA, FX_IDC, FXCM, FOREXCOM, CAPITALCOM, SAXO.

Crypto classification uses a `USDT` suffix or a hard-coded base-ticker list. “Always open” also uses hard-coded vendor/ticker lists. These are resolution heuristics, not a canonical supported-asset catalog. There is no symbol-search, capability, or availability endpoint. A response reports the resolved provider symbol, which is useful provenance, but no confidence or fallback explanation is returned.

### Technical calculations

The code uses the `technicalindicators` package on the fetched candle sequence:

| Output | Implementation |
|---|---|
| RSI | Period 14 |
| MACD | Fast 12, slow 26, signal 9 |
| SMA | Periods 50 and 200 |
| Bollinger Bands | Period 20, standard deviation 2 |
| Stochastic | Period 14, signal 3 |
| ATR | Period 14 |
| Trend | `uptrend` if last close > SMA-50 > SMA-200; `downtrend` if last close < SMA-50 < SMA-200; otherwise `sideways` |
| Support/resistance | 10th/20th and 80th/90th percentiles of candle closes, respectively; this is a quantile heuristic, not swing/pivot detection |
| ATR percentage | ATR divided by latest close, multiplied by 100 |

Periods count candles at the requested interval; they are not necessarily “days,” despite the OpenAPI descriptions for SMA-50/200. When history is too short, the code substitutes zero or the latest close for missing indicator results. It does not return an explicit “insufficient history” state, so a consumer cannot distinguish a real zero/flat reading from a fallback by inspecting the indicator value alone.

### Market sessions and volatility

For assets not classified as continuously traded, `getMarketStatus` uses fixed UTC weekday windows: Asian 00:00–08:00, European 08:00–16:00, and American 13:00–21:00. It reports overlaps for 08:00–09:00 and 13:00–16:00. This is a broad session heuristic, not an exchange-specific calendar or a holiday-aware schedule. Crypto vendors/tickers are reported as continuously open.

The optional `volatility.session_volatility` calculation measures `(high - low) / average close` for fetched candles whose UTC time-of-day falls in the currently active session. It is not a historical session series. The API does not document or return an explicit asset-class/session-calendar identifier.

### News and sentiment

`GET /api/news/:symbol` opens a TradingView chart session with a daily timeframe and range 1, then maps `chart.periods[0].news` into `{id,title,published,source,url,sentiment}` records. Missing sentiment is set to `neutral`; missing source is set to `TradingView`. There is no pagination, search, asset filter beyond the symbol path, or separate news provider. For an unqualified symbol, this path prefixes `BINANCE:` rather than using the market resolver's vendor fallbacks.

The checked-in API has no sentiment-analysis model or calculation. Per-article sentiment is copied from the provider item when present, otherwise defaulted to neutral. `news_sentiment` on market responses defaults to neutral and the inspected code has no calculation that derives it from the returned news. Treat sentiment as provider-supplied/placeholder data until verified against live responses; do not present it as independently analyzed sentiment.

## HTTP interface

Default base URL: `http://127.0.0.1:3199` (configurable with `HOST` and `PORT`). No deployed base URL was found.

| Method and path | Authentication | Inputs / behavior | Response and limitations |
|---|---|---|---|
| `GET /api/market-data/:symbol` | Required | `symbol`; optional `interval` (default `15`) | Price, latest timestamp, up to 120 candles, indicators, trend, support/resistance, market status, volatility, and `news_sentiment`. No range/pagination. |
| `GET /api/news/:symbol` | Required | `symbol` | `{ news: [...] }`; provider-derived article records, with no pagination contract. |
| `GET /api/health` | Public | None | `{ status, timestamp, version }`; reports `healthy` without checking MongoDB/provider readiness. |
| `GET /docs` | Public | None | Swagger UI HTML; loads UI assets from unpkg CDN. |
| `GET /swagger.json` | Public | None | Checked-in OpenAPI document. |
| `GET /routes.json` | Public | None | Runtime route enumeration. |

Authentication accepts `Authorization: Bearer <token>` or `x-api-key: <token>`. Tokens are 32 random bytes rendered as hex; MongoDB stores their SHA-256 hash, owner, status, created/expiry/last-used timestamps. The default lifetime is 30 days. `X_ADMIN_SECRET` via `x-admin-secret` creates an admin bypass identity; `AUTH_BYPASS=true` is allowed only outside production. The OpenAPI file labels Bearer tokens as JWT, but the implementation uses opaque random tokens, not JWTs. `requireAdmin` exists but no admin HTTP route was found in `index.js`.

`express-rate-limit` is mounted on `/api/` at 100 requests per IP per 15 minutes. This is the MarketFeed service's ingress limit, not evidence of an upstream TradingView quota. `NodeCache` holds market responses in process memory for its 900-second default TTL and news responses for 300 seconds. The market cache key is the raw symbol plus interval. If an upstream chart attempt fails, cached market data can be returned after refreshing the market-status field, but the response has no explicit stale flag or stale age. Cache state is not shared between instances.

### Errors and contract confidence

Code paths include 400 for a missing symbol, 401 for absent credentials, 403 for invalid/expired/revoked credentials, 502 for chart failure/no candle data, 503 for chart failure when the heuristic says the market is closed, and 500 for unhandled market/news errors. The common JSON shape is `{ error, details? }`. Error details may include provider exception text. The OpenAPI does not describe all actual outcomes (for example 500/503) or rate-limit responses. The README and OpenAPI are useful orientation but are not enough to establish a production contract; the implementation and a deployed service must be checked together.

Other contract details not established by this source inspection:

- Actual deployed base URL/environment, uptime, API compatibility/versioning, and operator ownership.
- The complete supported asset universe and actual provider resolution success rates.
- TradingView terms, licensing, attribution, redistribution, and commercial-use rights for MarketPilot.
- Upstream/provider rate limits, service guarantees, and acceptable polling/concurrency.
- Live response examples for missing/sparse history, market closures, invalid symbols, timezones, and provider outages.
- Freshness guarantees, data retention rules, precise interval semantics, and whether news sentiment is populated by the provider.
- Whether the docs' status codes, interval enum, schemas, and examples match the deployed build.

## Useful ideas to carry forward

These are capabilities and lessons to evaluate, not code or architecture to transplant:

1. **Provider symbol resolution:** maintain explicit, testable aliases and provider candidates behind an asset-normalization boundary. Return the normalized asset and resolved source/provider symbol. Replace heuristics with an approved catalog and observable resolution results.
2. **Candle normalization:** validate timestamp/OHLCV invariants, sort consistently, preserve source timestamps, and report dropped/invalid records and data quality rather than silently manufacturing values.
3. **Pure calculation layer:** indicators and trend calculations are separable from HTTP/provider code. In MarketPilot, give them explicit input windows/units/versioning, test realistic and sparse inputs, and return unavailable/insufficient-history states rather than values that look genuine.
4. **Freshness-aware resilience:** bounded cache and cached fallback can improve UI availability. Any MarketPilot adapter should expose `observedAt`, source, cache age, and `isStale`; stale observations must not silently trigger alerts or be presented as current.
5. **Market calendars:** session concepts can enrich analysis, but production status needs asset/exchange-specific timezone, holiday, and session definitions rather than hard-coded global windows.
6. **News provenance:** retain provider, article publication time, retrieval time, URL, and sentiment origin. Clearly distinguish provider labels from MarketPilot sentiment analysis, and treat article content as untrusted input.
7. **Contract and test discipline:** keep OpenAPI generated/validated against implementation, add real adapter contract tests with recorded sanitized fixtures, and use test doubles at the provider boundary. Current integration tests use mocked route handlers and therefore do not verify the ingestion/calculation implementation.

## MarketPilot boundary and architecture decision

- Keep MarketPilot's own API, domain model, auth/session system, PostgreSQL persistence, queue/workers, and application services. Do not copy this service's Express monolith, MongoDB token store, process-local cache, CLI token model, or route layout as MarketPilot's backend architecture.
- Do not add this Desktop repository as a Git submodule, workspace package, runtime dependency, or copied codebase.
- If approved after legal/operational checks, integrate the service only as an upstream HTTP provider behind a MarketPilot-owned adapter (for example, `packages/marketfeed`). The adapter owns authentication/configuration, strict request/response validation, timeout/error mapping, and conversion into stable MarketPilot types. Neither the web UI, bots, workers, nor AI tools should consume raw MarketFeed payloads directly.
- Keep MarketFeed-specific symbols and fields out of user-owned database entities where possible. Persist MarketPilot's canonical asset reference and provider observation/provenance separately; map provider fields at the adapter boundary.
- Do not assume the source repository's token is the final MarketPilot API key or end-user session design. MarketPilot owns its users, sessions, RBAC, and API keys.

## Questions before integration

1. What is the authoritative deployed MarketFeed base URL and API version, and who owns/supports it?
2. Is its TradingView data source licensed for MarketPilot's intended commercial display, redistribution, derived analytics, AI context, and bot notifications?
3. What assets and resolutions are confirmed supported, and can the service return an asset/provider catalog and resolution errors?
4. What are the actual freshness, request limits, maximum history, news coverage, and upstream-outage semantics?
5. Is sentiment supplied by TradingView, generated elsewhere, or merely defaulted? Which exact fields are reliable?
6. Can provider values/units and all API error cases be documented with sanitized examples and contract tests?
7. Should MarketPilot call this API as an external service, or selectively reproduce approved calculation/source capabilities behind its own provider adapter? This choice depends on licensing, operational ownership, and stability, not on this repository's architecture.
