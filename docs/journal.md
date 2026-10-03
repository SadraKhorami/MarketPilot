# Independent trading journal

Journal has two routes: `/dashboard/journal` (Trades) and `/dashboard/journal/analytics` (Analytics). Trading memory lives in AI settings; manual trades do not require an AI provider or an AI run.

## Records and calculations

Manual and imported records include market pair, side, base-unit quantity, entry/plan time, entry price, SL, one to three ordered targets and target exit percentages totalling 100%. Waiting plans have an explicit entry condition and validity deadline. Existing AI records retain observation-only behaviour.

Every partial exit stores its own quantity, price, fees, time, reason and result basis. Entry fees are allocated pro rata across exits. Realised P&L uses `(exit - entry) × exited base units × direction - allocated entry fees - exit fees`. No assumed leverage, lot multiplier or currency conversion is used. Analytics reports one quote currency at a time. Cash P&L is grouped by exit date; average and win rate use the full result of trades closed within the selected window. UTC groups chart days. Open mark-to-market P&L is not included.

## Automatic tracking

Manual records can enable automatic completed-candle tracking. Entry triggers support touch, close above or close below. Target allocation controls partial estimated exits. Stop gaps use the observed candle open when worse than the stop. Estimates do not represent broker fills and do not place orders; unknown exit fees and slippage are not fabricated. Estimates have a separate analytics filter. Broker reconciliation can replace estimated exits; observations stay in the timeline.

A missed waiting entry expires at the configured deadline. Range alone never expires an executed trade. Opening-candle uncertainty, simultaneous SL/TP, missing historical coverage and candle gaps pause automatic tracking and display “Needs review”. Available market history is bounded by the current provider; old records without full coverage need imported execution data or review. Adding a recorded exit switches the remaining trade to observation-only tracking to avoid duplicate inferred fills.

## Import

`.xlsx` and JSON arrays are supported, up to 200 records, 2 MB uploaded and 90 KB of extracted data. Excel uses the first sheet with unique headers and plain cell values. Workbook expanded size is checked before parsing. Column mapping and preview precede confirmation; invalid and duplicate records cannot be selected. All selected rows are validated again inside the transaction. Duplicate identity is market, direction, start, entry and quantity; previous manual records are also checked. Defaults (zero fees, equally split targets, timeframe, validity hours and timezone) are visible before preview. Historical imports default to observation-only tracking.

## Journal assistant

The assistant is scoped to selected trades or the latest 50 entries under the current filters; oversized contexts ask for a smaller selection. It reads compact server-computed evidence, not fabricated market data. Two previous answers provide follow-up context. Platform or personal OpenRouter settings are reused, including usage budgets. Structured output is specific to the journal; AI Analyst response formats remain unchanged.

Supported proposals: archive inactive trades, cancel waiting plans, expire waiting plans past their stated deadline. Proposals list exact records and require explicit confirmation. Confirmation rechecks ownership and status under row locks, is idempotent, and records an audit event. Archives can be restored. Assistant runs are retained for seven days and do not appear in market research history.

## Editing, deletion and attachment UX

Trade actions include prefilled editing and explicit permanent deletion. Both endpoints check ownership and the record version under a row lock. Editing keeps source attribution, timeline and recorded partial exits; executed market/side/status and combined partial-exit totals cannot be overwritten. Entry corrections and plan levels may be edited; changed levels begin observation from the edit time. Deletion removes only the owned journal record and its cascaded events/exits, not independent alert rules.

The journal assistant accepts Excel/JSON attachments directly in its composer. Mapping, validation preview and import confirmation render in the same conversation panel. Recognized columns collapse into an optional mapping section. File extraction is local to the API; it does not send the workbook to the AI provider. Analytics adapts the reference dashboard’s KPI strip and compact filter toolbar, with cumulative/daily charts and a real outcome summary.

## Chart context actions

Right-clicking the price plot captures the displayed price coordinate and interpolated time between observed candles. Future whitespace uses the last observed candle spacing for the time coordinate, without inventing a market value. Price-dependent actions are unavailable on volume and chart axes. Manual trade and alert forms open as sheets with this market, timeframe and price prefilled; future trade points default to a waiting plan starting now. No trade or rule is saved from the menu alone.

Existing alert markers/levels offer details, focus, edit, pause/resume and confirmed deletion. Journal markers and visible position areas offer details, focus, edit and the same confirmed deletion as the journal list. Changes emit feature events to reload market layers.
