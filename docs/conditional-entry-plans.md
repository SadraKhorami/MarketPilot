# Conditional AI entry plans

New research plans carry `conditionalEntry.version = 2`; existing JSON plans remain readable without fabricating new rules or news evidence. Preferences have an optional JSON entry policy. Existing preferences preserve their manual timeframe with the former higher-timeframe mapping. New preferences default to Auto. Apply migration `20261004120000_conditional_entry` before using the updated API. Prisma Client must be generated and normal package builds performed by the deployment workflow; the local migration is applied.

## Supported proposals

Auto proposes entry and trend intervals, scenario, condition and validity. The server rejects missing Auto selections and validates the proposal before exposing a plan. Scalp permits 1m/5m entry, day 5m/15m/1h, swing 1h/6h, hybrid 5m/15m/1h/6h. A trend interval must be strictly higher than entry. Manual choices override AI choices. Holding style does not close or expire executed trades.

Breakout uses the preceding twenty completed-candle range boundary. Pullback requires an observed break of the earlier range (the forty-four candles preceding the recent six). Stops use recent swing extremes plus a quarter ATR; targets are observed structural levels, ordered beyond Entry. Both timeframes require sufficient, fresh completed candles and aligned moving-average context. Entry candles must have valid OHLC ordering and a continuous recent window. Closed markets, stale prices, invalid level ordering, excessive stop distances, missing targets and entries too far from current price produce an unavailable reason.

Supported entry rules are a range touch (pullback only), a completed close beyond Entry for breakout, a retest of Entry followed by a close on the breakout side for pullback, and a completed break followed by a separate later retest candle that touches Entry and closes on the breakout side. OHLC never proves intrabar ordering. Reversal rules are unavailable. A daily entry has no supported higher interval and is unavailable for a new conditional plan.

Entry validity is an explicit count of one to twelve entry candles, capped at seventy-two hours, with an exact deadline and stored reason. It is independent of holding duration. Distance is capped at one and a half ATR; chasing a breakout more than a quarter ATR beyond the entry area is rejected. Pullback proposals may wait for price to return to Entry within the distance bound. These are deterministic guardrails, not calibrated performance probabilities.

## Evidence, confirmation and history

Every explicit setup request retrieves relevant stored news before model planning. Availability, latest publication, retrieval time and a twenty-four-hour freshness rule are preserved. Missing or stale news is disclosed rather than replaced with invented events. No economic-calendar connection, bid/ask spread, broker commissions or executable liquidity exists in the present observation contract; the plan declares these unavailable.

Sizing uses manually supplied capital × risk percentage / entry-stop distance, expressed as indicative base units. Currency conversion is not invented; sizing is unavailable when account and quote differ. Costs and broker contract/lot constraints are excluded. Open risk uses recorded Journal positions and their remaining quantities in the matching quote. Unknown, estimated and other-currency positions are counted as unknown. No broker-wide coverage or free balance is claimed, including when no recorded Journal positions exist.

Before saving, the API rechecks matching fresh data, entry distance, invalidation and deadline. It saves the server proposal and confirmed context, not browser-supplied levels. Generic editing cannot mutate a confirmed v2 plan's levels, timeframes, conditions or expiry. Chat edits create a fresh proposal. A confirmed replacement atomically cancels only the prior unexecuted waiting plan, retains its original data, and creates links in both timelines. Plan-content hashes protect revisions without treating routine monitor updates as plan edits. Open trades cannot be replaced.

AI plans are automatic simulations. Entry opens when the saved condition is observed; completed one-minute candles establish touch and SL/TP ordering, while close/retest confirmations use the saved analysis timeframe. Entry expiry affects waiting simulations only. Ambiguous ordering inside a one-minute candle and unavailable historical coverage pause tracking without inventing fills. TP allocations split the supplied quantity equally by default; fees are zero unless supplied. Without capital, reference-unit fills measure return percentages while quantity remains null and monetary analytics exclude the simulation. No brokerage integration is involved. Historical observation events remain in the audit timeline after an explicitly recorded simulation repair.

## Journal execution integrity

Unchanged date-picker values retain their original seconds and milliseconds. User-edit versions exclude routine monitor timestamps but include actual trade fields and exits. Manual corrections preserve partial exits, prevent reverting an executed position to an unexecuted plan, and keep estimated fills labelled as estimates when only notes change. Exit fees are separate from entry fees; realized results allocate entry fees to the exited quantity. Position value can be entered in quote currency and converted using the entered execution price without rounding unchanged quantities.

Confirmed AI executions have a separate actual-entry editor that preserves the original proposal. Replacing a closed estimated result requires explicit actual entry and exit details. Earlier observations remain in the timeline. Monitoring uses execution/revision-specific event keys, refuses stale snapshots of concurrently edited plans, and pauses when partial-candle timing or missing coverage makes an outcome unknowable.

## Verification scope

The AI suite passes 27 tests, the API suite passes 64 tests, and the frontend stream suite passes 3 tests. Regression cases cover long/short pullback retests, alert approach direction, explicit reconciliation, same-candle ambiguity, partial-candle timing, missing candle coverage, stop gaps, fee allocation and edit versions.

A local database verification transaction also exercises manual creation, idempotent partial exits, editing after monitor updates, entry correction, closing, analytics, deletion, estimated-result reconciliation, and recording an earlier execution after AI plan expiry. All verification records are rolled back. Run it only against a local development database:

```sh
pnpm --filter @marketpilot/api exec ts-node --project tsconfig.json scripts/verify-journal.ts
```

AI and API builds and API/frontend TypeScript checks pass. Browser verification remains pending authenticated access. These checks do not exercise a real broker or establish strategy profitability.
