# Notification center

## Implemented

- PostgreSQL `Notification` stores a user-owned inbox message, category (`SECURITY`, `ACCOUNT`, `ANNOUNCEMENT`), severity, plain-text content, related page, and read/archive timestamps. Archive/restore is reversible. No historical audit events are backfilled as new notifications.
- Navbar: bounded scrolling for the latest eight messages, unread badge, mark-all-read, details and preferences/inbox shortcuts. The full inbox adds owner-scoped search, category/status filters and server pagination.
- Synchronization: summary polling every 60 seconds while the tab is visible/online, focus refresh with a 10-second cooldown, immediate refresh after actions, and same-browser tab invalidation via BroadcastChannel. This is polling, not WebSocket/device push. Reloads retain existing rows while updating.
- Real events: successful sign-in, session revocation, API key creation/revocation, welcome after registration, and new-registration notices for active administrators. Audit history stays separate. Event notification write failures are logged without turning a completed security/account operation into a failure; durable outbox retries are a future requirement.
- `inAppEnabled` controls optional product announcements and market alerts. Security/account-access notices remain available. Email preferences are stored only; email and device push are not implemented. Telegram/Discord market-alert preferences and delivery state are independent; see [bot integrations](bot-integrations.md).

## Administrator announcements

Draft → publish or cancel. Create/edit uses a title, bounded plain-text body, priority, audience (all active accounts / non-admin users / administrators) and an optional allowlisted workspace destination. There are no external URLs, HTML or arbitrary recipient-ID inputs.

Publication previews current eligible/excluded counts. It checks the reviewed `updatedAt`, claims the draft, resolves recipients in a repeatable-read transaction, inserts in batches of 500 and records the publication audit event. Any failure rolls back the entire send. No eligible recipients leaves the draft unpublished. Concurrent/stale/repeated publication returns 409; a unique announcement/account pair also prevents duplicate messages. Published messages are immutable. Cancellation preserves the draft history.

Preferences and active status are evaluated when publishing. A non-admin audience excludes accounts holding ADMIN even when they also have USER. Notices are stored in inboxes, not emailed. Administrative read metrics are aggregates of current `readAt` states; marking unread changes them. Published recipient/exclusion counts are historical snapshots; user deletion can reduce the current stored-message/read totals. No administrator endpoint exposes individual users’ private security inboxes or read receipts.

## API boundaries

All routes require a browser session; API keys are rejected.

| Route | Purpose |
|---|---|
| GET `/notifications` | Paginated personal inbox; `status`, `category`, `search`, `page`, `pageSize` |
| GET `/notifications/summary` | Personal unread/inbox/archive counts |
| POST `/notifications/read-all` | Mark current non-archived messages read |
| PATCH `/notifications/:id` | Owner-only `read` and/or `archived` booleans |
| GET `/admin/notifications`, `/summary`, `/audience` | ADMIN announcement collection, metrics and eligible audience preview |
| POST `/admin/notifications` | ADMIN draft creation |
| PATCH `/admin/notifications/:id` | ADMIN full draft edit with `expectedUpdatedAt` |
| POST `/admin/notifications/:id/publish`, `/cancel` | ADMIN version-checked state transitions |

Global authentication, RBAC, origin and rate guards apply. Bodies, recipients and destinations are validated server-side. Polling is session traffic and never contributes to user API-key Usage. Swagger describes the endpoints. No credential, notification body or query content is copied into request metadata.

## Verification

`pnpm run ci` checks lint, formatting, types, the 42 existing regression tests and all builds. HTTP checks against a temporary PostgreSQL schema verified ownership/role/key boundaries, actual security/account events, read/unread/archive/restore/read-all, preference and disabled-account exclusions, input/link validation, stale edits/publication, sequential/concurrent duplicate and cancelled publication, zero-recipient rollback, delivery/read aggregates and key-only usage. The isolated schema was removed; no announcements were sent to existing accounts. Browser/visual inspection was intentionally omitted at the user’s request.

The local development process was restarted after it was found serving an older API version without notification routes. Authenticated requests against the actual API on port 4000 then returned 200 for personal/admin lists, summaries and audience preview; anonymous summary access returned 401. The temporary verification session was logged out.

## Remaining production work

Notification retention/export policy, asynchronous large-audience announcement delivery and external channels remain outside this phase. Market-trigger evaluation and its durable outbox/retries are implemented by the Phase 5 worker.

## Phase 4 boundary

An AI alert confirmation saves an owned rule and its existing alert audit event. Confirmation itself does not create an inbox message. The Phase 5 worker evaluates the rule, and a later valid crossing can deliver a market-alert inbox entry. Phase 6 additionally snapshots verified opted-in Telegram/Discord destinations into an independent external outbox; inbox state is not reused for those channels.


Phase 5 adds MARKET_ALERT to the durable inbox, category filter and unread count. Optional alert delivery checks active account, rule and WEB in-app preferences; security events keep their existing behavior. See [alert engine](alert-engine.md) for the transactional outbox, idempotency and recovery policy.
