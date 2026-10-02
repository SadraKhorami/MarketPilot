# AI Analyst — Phase 4

## Setup and current boundaries

Install workspaces, generate Prisma, and apply checked-in migrations before starting the updated API:

```sh
pnpm install
pnpm db:generate
pnpm --filter @marketpilot/db migrate:deploy
pnpm dev
```

Configure only on the server:

```dotenv
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Use an exact OpenRouter catalog model supporting tools, tool choice and structured outputs. No model is guessed and no provider fallback exists. Restart the API after changing configuration. `/ai/status` reports configuration, not a successful inference or provider connection. Model discovery and published pricing are checked before inference, cached for five minutes, with one shared bounded in-flight catalog read per API process. Keys never enter browser bundles, tool arguments, prompts, fixtures, logs or the repository. Prompts and bounded news/watchlist data necessarily go to OpenRouter and the selected upstream provider; review provider privacy requirements for your deployment.

Sentiment scoring, historical watchlist-change analysis, trade execution and payments through AI are unavailable. Phase 5 evaluates saved alerts, and Phase 6 adds private bot research through this same service; bot alert proposals still require the existing authenticated browser confirmation. RSS ingestion remains subject to its existing permission/configuration requirements. This phase reads only already stored news.

## Browser-session API

Swagger at `/api/v1/docs` registers these routes. Every route requires a valid browser session; API keys have no AI access. Existing global auth, origin, role, rate and scope guards remain active.

| Method / path (under `/api/v1`) | Contract |
| --- | --- |
| `GET /ai/status` | Safe provider configuration message, capability limitations and retention. No key or private content. |
| `GET /ai/history?conversationId=<UUID>` | Last twenty owned turns in chronological order. Includes result or terminal status; current proposal state is read from the server. Owner always comes from the session. |
| `POST /ai/research` | Strict `{requestId, conversationId, input, watchlistId?}` body. Both IDs are UUIDs, input is nonblank and at most 2,000 characters. Optional selected watchlist must be owned when used. POST returns typed SSE progress and one final result/error, never provisional numerical claims. |
| `POST /ai/proposals/:id/decision` | Strict `{runId, decision:"confirm"|"cancel"}`. No client-supplied condition, threshold, owner or destination. Confirms/cancels only the owned, completed run's proposal. Standard REST envelope/error codes. |
| `GET /ai/metrics` | ADMIN browser sessions only: seven-day aggregates for statuses/tokens/tools/latency/reported cost/reservations. No private message content. |

SSE frames are `data: <JSON>\n\n`; comment heartbeats carry no data. `StreamEvent` and its strict schema live in `packages/ai/src/contracts.ts`:

- `progress`: `{type:"progress",message}` — real orchestration stage.
- `tool`: `{type:"tool",tool,state:"running"|"complete",status?}` — validated application lookup.
- `result`: `{type:"result",result:{runId,conversationId,answer,sources,proposals,tools}}` — fully validated final output.
- `error`: `{type:"error",code,message}` — safe terminal failure.

Authentication/input/unconfigured-provider failures before streaming use the existing REST error convention; errors after SSE headers use a terminal error frame. A completed `(userId,requestId)` returns its saved result without spending again. Different input/context under the same ID is a conflict. Failed/cancelled IDs are terminal; retry uses a fresh UUID. A connection interruption should recover `/ai/history` first to avoid repeating a completed turn. The UI keeps the current conversation ID in session storage, never credentials or private transcript text.

## Tool and grounding contracts

Only seven functioning tools are exposed. All arguments and results pass strict Zod schemas, with owner identity supplied by the API:

- `getMarketPrice`: validated exact product price, quote unit, trade observation and retrieval times, provider and cache freshness.
- `getTechnicalIndicators`: existing pure calculations over 30–300 actual candles and the requested documented interval. Missing values stay null, with explicit limited-history status.
- `getTrendAnalysis`: deterministic trend and observed price levels over the selected window, never a forecast.
- `getMarketNews`: one to five relevant stored RSS metadata records, original HTTPS source links, title/excerpt (at most 600 characters), publication/retrieval times. Strings are untrusted source material.
- `getWatchlist`: selected owned list or first owned list, at most four observed assets, total count and visible omissions. An explicitly selected list cannot be replaced by model arguments. Empty/missing lists have compact states.
- `compareAssets`: two to four products, one interval/window; intersect actual observed candle ranges, retain each asset's quote unit and partial errors. It does not infer an FX conversion or manufacture percentage comparisons across unmatched quotes.
- `createAlert`: only available for a conservative explicit current-turn request to create/set/propose an alert. Supports price or RSI above/below conditions, validates the exact product and proposes one server-side rule. A separate expiring user confirmation is required before saving. General explanations, negations, previous history and article text do not authorize it.

Bare ticker names use the existing dashboard USD convention (`BTC` → `BTC-USD`, `ETH` → `ETH-USD`); unsupported products still fail through the application's provider. Explicit quote assets are never converted. Displayed source cards disclose the actual resolved pair. Tools call services in process, not SQL, arbitrary HTTP or the Desktop reference server. Per-run promise memoization reuses market snapshots in addition to the existing service cache.

Market-analysis requests are rejected if the provider skips all evidence retrieval. Observed facts and chart points come entirely from locally validated tool results. Model output is strict qualitative interpretation with exact source IDs; missing/unknown references, digit-bearing numeric/date text and model URLs are rejected. Source links are server-provided and restricted to HTTPS. This reduces unsupported numerical claims but does not prove semantic interpretation or every word-based claim correct. Interpretation remains visibly distinct and fallible. No system-prompt-only claim of hallucination immunity is made.

Article/tool strings are delimited as `untrustedSourceData`; earlier turns are bounded untrusted context and cannot act as current evidence. Neither article instructions nor model responses can change owner, allowed operations, destinations or confirmation state. Responses render as plain React text; there is no unsanitized HTML, model URL execution, code execution, reasoning streaming or tool-provided identity.

## Resource and spend limits

- Per-user research admission: six requests per minute and one active run. Global active-run limit: four. All are independent from browsing/developer-key limits. Redis admission fails closed.
- At most four planning rounds plus one final structured-output call; eight tool executions; one alert proposal per run. Repeated identical lookups and reused tool call IDs stop the run.
- Server deadline: 90 seconds; provider call deadline: 30 seconds; browser deadline: 100 seconds. Cancellation stops application work and aborts upstream requests. Current non-streaming upstream requests may continue processing/billing after disconnect; the reservation is intentionally not refunded on cancellation/failure.
- Provider request body at most 24 KB, output at most 1,200 tokens per call, provider response at most 64 KB (catalog at most 4 MB). Input at most 2,000 characters; prior context uses the last two completed turns with bounded excerpts/interpretation. News excerpts and result arrays are bounded; charts use at most 300 real candles per source. Browser stream at most 2 MB.
- Published input/output/request prices are validated and conservatively reserved for all five maximum-size calls. Request ceiling: USD 0.25; UTC daily reservations: USD 1 per user, USD 10 globally. Reservations expire in Redis after two days and are distinct from actual provider-reported cost; unreported cost remains null. These are protective admission estimates, not a billing system or a guarantee against provider price changes/additional charges. Set a provider-side key/workspace spending cap for an independent upstream limit.

Private turns/results have seven-day logical retention. Cleanup deletes up to 100 expired rows on configured research requests; no background retention job exists. Idle physical rows may outlive logical expiry. Abandoned runs are marked failed after two minutes on the next configured request. Confirmation expires after ten minutes; a transaction atomically claims the pending proposal and creates/audits the alert. Replays return the already-applied alert ID, cancellation blocks confirmation and tampered run/owner/body values are rejected. Phase 5 evaluates confirmed rules and delivers later crossings to the inbox; confirmation itself does not trigger an alert.

## Verification

Deterministic provider fixtures exist only in tests. Package/API coverage includes schemas, tool selection, product resolution, ownership/session/RBAC/key boundaries, stale/partial/missing data, provider failure/timeout/cancellation, bounded loops, untrusted source instructions, citations/empty output and proposal expiry/tampering/idempotency. Live provider success additionally requires a configured key/model and a real inference; passing mock tests does not establish it. Browser visual QA is deliberately omitted at the user's request. See the delivery summary for the exact checks performed against the current local runtime.

### Local verification snapshot (2026-10-01)

`pnpm run ci` passed lint, formatting, type checks, 83 automated tests (57 API, 16 AI, 3 browser-stream, 4 market-data and 3 news), and all production builds. Two existing web lint warnings in the Alerts screen remain; Phase 4 adds no lint warning. The Phase 4 migration is applied and Prisma reports the local schema up to date.

HTTP smoke checks used the actual development API on port 4000: all five AI paths appear in Swagger; anonymous access returns 401, scoped API keys and non-ADMIN metrics access return 403, browser-session status/history and ADMIN metrics work, and unconfigured research returns safe 503. Isolated disposable database fixtures exercised real confirmation ownership, body/run tampering, origin checks, expiry, cancellation and simultaneous replay; exactly one alert and audit were saved. The temporary accounts and their owned records were removed, preserving existing accounts. Live Redis checks confirmed admission/release, the six-request limit and the per-user daily reservation cap. The AI page returned HTTP 200 on web port 3000. API development was reloaded after production checks.

At the initial Phase 4 delivery, both `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` were absent locally, so no real model/tool research response had been verified. Provider and research-loop tests use explicit deterministic fixtures and do not establish live inference success. No browser tabs, screenshots or visual QA were performed, following the user's preference. Existing notification/API-key UI changes remain outside the Phase 4 commit.

### Live provider follow-up (2026-10-01)

The supplied key was saved only in the ignored local `.env` with owner-only file permissions; `OPENROUTER_MODEL` is explicitly `openai/gpt-4.1-mini`. OpenRouter key authentication succeeded. A live request revealed that `parallel_tool_calls` is not advertised by this model's endpoints; with strict parameter routing it caused HTTP 404. The adapter now omits that optional parameter while keeping strict parameter/privacy routing, bounded tool counts and sequential application execution. All 17 AI-package tests, lint, formatting, type checking and its production build passed.

Against the reloaded API on port 4000, a real Persian indicator explanation and a focused BTC-USD price request both completed with validated results. The price tool returned a fresh observation; owned history and completed-request replay succeeded. A broader price/technical/trend/news request exercised all four tools but its final interpretation was rejected with `AI_UNGROUNDED_ANSWER` because it contained numerical text. Technical/trend results were partial and stored news was unavailable in that run; no successful broad analysis is claimed. Temporary accounts and owned records were deleted, and no alerts were created. No browser or visual QA was performed.

## Indicator calculation and chart windows

AI tools display the requested candle window and calculate indicators from all available earlier candles through that window's endpoint. For comparisons, the shared endpoint excludes later observations from both indicator initialization and the displayed price. Support/resistance continues to use the displayed window. Sources expose optional `calculationHistory` (start, end, count) separately from chart history, preserving compatibility with retained conversations. Partial results explain missing metrics or a shorter-than-requested chart; absent values remain null. Analytics already uses provider indicators calculated over the full returned history and now shows the candle count and minimum-history reasons for unavailable moving averages/MACD. Display rounding does not change stored values or calculations.


Phase 5 follow-up: confirmed proposals create the same active, owned 15m alert rules used by the background evaluator (60-minute cooldown, first-observation baseline). Inbox delivery honors in-app preferences; confirmation remains explicit. See [alert engine](alert-engine.md).

### Conversation history

The AI Analyst History panel lists the signed-in account’s unexpired research conversations, including bot-originated research. `/api/v1/ai/conversations` supports bounded pagination and searches stored questions. Selecting a conversation loads its latest twenty turns and keeps a `conversation` URL parameter for reopening it. Research remains subject to the existing seven-day retention policy; empty new conversations are not stored. Switching conversations is disabled during an active research request.

### Conditional entry scenarios

Only a current, explicit request for a trade setup, entry/exit, BUY/SELL scenario or targets enables `getTradeSetup`. Ordinary research cannot call it. The model explains the scenario; numeric levels are calculated on the server from fresh completed candles, never generated in the interpretation text. This initial strategy uses the previous completed-candle range for its breakout trigger, recent swing extremes plus an ATR buffer for the stop, and one/two entry-to-stop risk multiples for TP 1/TP 2. AUTO chooses a direction from moving-average context. The response distinguishes waiting for a pullback, waiting for a breakout, and an observed breakout. It can return no scenario for old/missing data, an invalidated or already-passed entry, or an excessively wide stop. These are conditional strategy levels, not forecasts, backtested performance claims or executable broker orders. Fees, spread and slippage are excluded.

The dashboard offers a configurable warning distance and explicit **Yes, create alert** action. `POST /ai/runs/:id/entry-alert` accepts only `{distance, unit, confirm:true}`. The server loads the owned completed scenario, checks its ten-minute validity and a fresh market observation, derives the price threshold, and saves the alert/confirmation atomically. Repeated identical confirmation returns the existing rule; another distance conflicts instead of creating a duplicate. No model approval or bare conversational yes can create it. Alert evaluation uses one-minute observations, the existing first-observation baseline and channel preferences; it is neither tick-level monitoring nor confirmation that the trade setup passed. Dashboard history preserves the saved interval.

Forex pips follow the reference OANDA currency convention; XAU-USD uses the explicit OANDA cent convention. Other instruments use their quote-price distance. The card always shows the conversion. References: [OANDA forex pips](https://www.oanda.com/bvi-en/skills-and-insights/education/introduction-to-trading/basics/what-is-a-pip/), [OANDA XAU-USD convention](https://help.oanda.jp/oanda/faq/show/2126?site_domain=default).

### Response layout

Conditional scenarios lead with Entry, Stop loss and targets. The near-entry action shows the actual trigger price prominently; the editable amount is explicitly labeled as the distance before Entry (quote currency or pips). Interpretation, source evidence and lookup details remain available under **Analysis & sources**. Confirmed near-entry alerts appear once, with their saved threshold and an Alerts management link. Expired scenarios cannot create new alerts.
