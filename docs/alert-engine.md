# Alert engine (Phase 5)

The API saves owned rules. `apps/worker` runs BullMQ workers for `market-refresh`, `alert-evaluation` and `notifications`, using the existing Redis server and the isolated `marketpilot-jobs` prefix. The existing RSS refresh, conditional ingestion and feed-state/lock keys remain intact. No AI calls or customer API keys are used by the engine; Telegram and Discord are added through the independent Phase 6 outbox documented in [bot integrations](bot-integrations.md); sentiment conditions and trade execution remain unavailable.

## Setup

From the repository root, with PostgreSQL and Redis running:

```sh
pnpm install
pnpm --filter @marketpilot/db migrate:deploy
pnpm --filter @marketpilot/market-data build
pnpm --filter @marketpilot/jobs build
pnpm --filter @marketpilot/news build
pnpm --filter @marketpilot/worker build
pnpm --filter @marketpilot/api build
pnpm --filter @marketpilot/worker start
```

`pnpm dev` builds dependencies and starts web, API and worker via Turbo. A direct worker development launch is `pnpm --filter @marketpilot/worker dev` after dependency builds. Source and compiled launches load the root `.env`. The API and worker both require the Phase 5 migration and regenerated Prisma client. Stop workers with SIGTERM/SIGINT to drain current jobs before closing Redis and database connections. Invalid numeric settings fail startup rather than silently changing behavior. Use the same configuration for every worker instance.

## Supported semantics

| Condition | Compared value | Threshold unit |
| --- | --- | --- |
| PRICE_ABOVE / PRICE_BELOW | Coinbase provider quote, or TradingView's latest completed candle close | Market quote currency |
| RSI_ABOVE / RSI_BELOW | Shared Wilder RSI14 calculated over all available completed provider candles | Index, 0–100 |
| PERCENT_CHANGE_ABOVE / PERCENT_CHANGE_BELOW | `(latest completed close / preceding completed close - 1) * 100` | Percent per selected candle interval |

Intervals are 1m, 5m, 15m, 1h, 6h and 1d; the default is 15m. Price rules use the selected interval for data validation and grouped refresh; Coinbase price comparison still uses its quote. This percentage condition is **not** rolling 24-hour change. Sentiment and arbitrary indicators have no controls. External delivery is enabled per verified account in Bots; rules do not select individual channels. Canonical symbols must be available in the catalog (e.g. BTC-USD, XAU-USD); unsupported existing legacy rules are recorded as invalid rather than silently converted.

Comparisons are strict `>` / `<`. The first valid observation establishes `matched` without notifying, even when already beyond the threshold. A trigger requires previously unmatched → matched. Equality or returning to the other side rearms the rule. Staying matched never generates periodic reminders. Crossings within the cooldown are consumed: the condition must reset and cross again after cooldown. New/resumed/edited conditions require a fresh baseline; changing only the name preserves state. Cooldown defaults to 60 minutes and accepts whole minutes from 0–10080. Thresholds fit Decimal(24,10), including at most ten decimal places.

Repeated/older observation timestamps are ignored. Quote timestamps identify price observations; completed candle end timestamps identify technical/candle-close observations. The engine cannot reconstruct crossings between polling observations or during an outage. Concurrent evaluation may skip an older observation that arrives after a newer one. Disabled/deleted rules are checked again inside the database lock. Deletion removes the rule's trigger history and pending outbox rows; already delivered inbox entries remain user-owned and their link leads to an unavailable-rule state.

## Provenance and freshness

Market refresh calls the existing server-only MultiMarketProvider: Coinbase Exchange for crypto, anonymous TradingView for configured metals/forex/stocks. XAU-USD must match OANDA:XAUUSD and USD; TradingView's provider adapter checks its instrument and quote currency before returning data. No Twelve Data key is needed. The worker verifies canonical symbol, exact provider symbol, source, interval, positive/finite prices, valid ordered OHLC candles and timestamps again. Provider schemas validate responses. There is no stale-cache fallback in the evaluator.

Quotes and queued snapshot age default to at most 120 seconds; future timestamps beyond five seconds are rejected. Only completed candles enter RSI/change/candle-close evaluation. A candle's end must be within one interval plus quote-age grace of current time, allowing one completed bar behind the current interval. Closed/weekend markets therefore wait for fresh bars and do not alert on old closes. Missing RSI, nonconsecutive percentage-change bars and invalid data set an operational reason on the rule, without creating user notifications. Indicators use all available history (providers request up to 300 candles), separate from chart windows. The engine does not invent values or use AI to fill gaps.

## Scheduling and limits

`ALERT_REFRESH_SECONDS` defaults to 60 (30–3600). Active rule markets are grouped by canonical symbol and interval across users. Queue deduplication keeps a group from being enqueued while its previous refresh is unfinished. Market-refresh global concurrency defaults to 2 (maximum 3), protecting the TradingView adapter across worker instances. Its distributed limiter defaults to 20 jobs/minute, including dispatcher jobs; a Coinbase job makes two provider requests. The API has its own existing interactive provider limits, so this is not an account-wide rate guarantee. Evaluation/notification concurrency each default to 4 (maximum 16 per process).

Refreshing many distinct markets can take longer than the nominal cadence. Dispatchers recover up to 200 pending observations and 200 pending deliveries per pass, rotating by last publication time so retained failures cannot starve newer work. Queue counts and actual worker heartbeats are visible under Administration → System. Heartbeats indicate running worker processes within 45 seconds, not provider health or proof of successful delivery. User alert timestamps/reasons show actual outcomes.

## Durable flow and recovery

1. A validated provider observation is stored in `AlertObservation` before enqueue. It is the recoverable evaluation outbox. Queue publication failure leaves it pending.
2. Evaluation locks each alert row and atomically persists state plus `AlertTrigger`. Pauses/edits/deletion serialize on that row. Unique `(alertId, observationAt)` prevents duplicate triggers.
3. Pending trigger rows form the notification outbox. Queue jobs carry only record IDs. Delivery locks the alert and trigger, verifies ownership/account/rule/preferences, then atomically upserts the inbox entry and marks delivered. Unique `Notification.triggerId` prevents duplicate inbox entries after retries/crashes.
4. An unfinished stage is republished on subsequent dispatch. Redis loss does not erase database events. Restart a worker after loss of Redis scheduler metadata to recreate schedules; use Redis AOF persistence and an appropriate no-eviction policy in production. Replayed observations that are now stale are completed without creating triggers; already persisted valid triggers remain eligible for delivery.

Jobs get bounded attempts (`ALERT_JOB_ATTEMPTS`, default 5), exponential backoff starting at two seconds, and BullMQ's stalled-job recovery. Exhausted jobs remain inspectable and are not automatically retried while retained; their outbox row gets `JOB_ATTEMPTS_EXHAUSTED` on reconciliation. Admins may retry a retained failed job; repeated concurrent retry requests are harmless once it leaves failed state. Completed queue history is bounded by one day/1000 jobs and failed history by seven days/1000 jobs. If Redis drops or ages out a failed job, a still-pending durable stage can be published again with a new bounded retry budget. Database deduplication remains the authority. Completed observation payloads are removed after seven days; pending stages and trigger history remain until rule/account deletion. Plan storage retention separately for larger deployments.

The delivery semantics in this document describe the dashboard inbox. Phase 6 external delivery is separate and never overwrites inbox status. Active accounts with in-app notifications enabled receive MARKET_ALERT entries, included in existing unread counts, search, category filtering, details and read/archive flows. Absent WEB preferences use the default enabled behavior; explicitly inactive WEB channels or `inAppEnabled=false` suppress delivery. Paused rules/disabled accounts also suppress pending delivery. A suppressed trigger remains in history and is not delivered retroactively when preferences change. Security notices retain their existing unconditional security-event behavior.

## API and operations

- `GET /alerts` — owned, bounded pagination (`page`, `pageSize <= 50`, `search`, `status=all|active|paused`). This now returns a page object; integrations previously expecting an array must read `data.items`.
- `GET /alerts/summary`, `GET /alerts/:id`, `GET /alerts/:id/history` — owned counts, rule state, paginated immutable trigger snapshots.
- Rule creation/update/delete retains the existing routes and session authorization. Read API keys still require `alerts:read`; they cannot mutate rules. Explicit AI proposal confirmation uses the same creation/validation path and default 15m/60m policy.
- `GET /admin/jobs` — queue counts, Redis availability, actual recent process heartbeat count and durable pending counts.
- `GET /admin/jobs/:queue` — bounded retained jobs in `failed|waiting|active|delayed` state.
- `POST /admin/jobs/:queue/:id/retry` — retry only retained failed jobs with an audit event. All endpoints require an admin browser session; customer API keys are rejected by the existing scope guard.

Operational output contains IDs, queue, attempts and bounded reason codes, never job payloads, provider URLs, stack traces or credentials. No purge, force-complete, queue pause, arbitrary job creation or external message action is exposed. Provider/internal background requests do not enter customer API-key usage metrics.

Scheduling uses BullMQ's [job schedulers](https://docs.bullmq.io/guide/job-schedulers/); delivery correctness relies on database constraints because [queue job ID deduplication ends when a job is removed](https://docs.bullmq.io/guide/jobs/job-ids).

## Verification for this delivery

Prisma generation/database package build, jobs/API/worker TypeScript checks and production builds passed. Web type checking and a full Next production build passed in an isolated `work/` copy, preserving the user's running `.next` directory. API/worker/jobs lint and format checks passed; web lint completed without errors with three pre-existing warnings in research-sources/dashboard-overview, and web formatting passed. The migration deployed successfully to the local database and migrate status reported up to date. Read-only operational snapshots found one recent active worker heartbeat and completed recurring dispatcher jobs. Two retained startup dispatch failures predated readiness of the migrated schema/client; there were no saved rules or trigger deliveries to inspect. Final diff whitespace/boundary review was performed.

No automated tests, browser inspection, fabricated observations, forced trigger delivery or paid AI calls were performed. Runtime heartbeat/build success does not verify every crossing/crash scenario; user visual review and an explicitly authorized integration-test pass remain outstanding verification.

## Phase 6 external channels

New triggers atomically create per-channel delivery records only for verified, active and explicitly opted-in Telegram/Discord destinations. The separate external queue rechecks account/rule/channel eligibility, preserves independent receipts and attempts, and handles ambiguous provider acceptance without claiming exactly-once delivery. Existing in-app preferences, trigger history, deduplication and audit boundaries remain intact. See [bot integration setup and recovery](bot-integrations.md).
