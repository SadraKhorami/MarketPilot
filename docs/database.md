# Initial Database Proposal

PostgreSQL is authoritative and Prisma owns schema/migrations. Use UUID primary keys, UTC timestamps, explicit ownership foreign keys, and database constraints for invariants. The entities below are proposals, not a migration. Market-specific asset fields must follow the confirmed MarketFeed contract.

## Core entities

| Entity | Important fields and relationships | Indexes / constraints | Security and lifecycle |
|---|---|---|---|
| `User` | `id`, normalized unique `email`, `passwordHash`, `status`, timestamps; has sessions, watchlists, alerts, channels, keys, usage, activity | Unique normalized email; status index if operational queries need it | Store only an Argon2id password hash; no plaintext secrets. Verify email policy before account activation. |
| `Role` | `id`, unique stable `name`; many-to-many with users via `UserRole` | Unique role name; unique `(userId, roleId)` join | Seed a small fixed role set (for example user/admin); never trust a client-supplied role. Additional `UserRole` join table is required for multi-role RBAC. |
| `Session` | `id`, `userId`, `tokenHash`, created/last-seen/expiry/revocation timestamps, optional coarse device metadata | Unique token hash; `(userId, expiresAt)` and expiry indexes | Generate high-entropy opaque tokens; store only a hash; revoke on logout, password reset, or suspicious activity. Avoid storing full IP/user-agent unless retention and privacy needs justify it. |
| `Watchlist` | `id`, `userId`, `name`, timestamps; owns items | `(userId, name)` unique or otherwise enforce a documented naming policy; `(userId, updatedAt)` | Every read/write scopes by owner. |
| `WatchlistItem` | `id`, `watchlistId`, normalized provider asset identifier, display metadata only if verified, position/created time | Unique `(watchlistId, assetId)`; `(watchlistId, position)` | Foreign-key cascade on owning watchlist; do not accept arbitrary asset identifiers as supported until the provider universe is known. |
| `Alert` | `id`, `userId`, optional `assetId` per confirmed domain model, condition type/operator/threshold in typed columns, enabled state, cooldown, last-evaluated/triggered times, timestamps | `(userId, enabled)`; `(enabled, nextEvaluationAt)` if scheduled polling is used; asset/evaluation index based on job design | Validate conditions against a versioned schema and supported measures. Ownership on all mutations. Never interpret JSON as executable logic. |
| `NotificationChannel` | `id`, `userId`, `provider` (`telegram`/`discord`/web), external account/recipient ID, verified/active timestamps, encrypted provider-specific metadata only when needed | Unique `(provider, externalAccountId)` when provider semantics permit; `(userId, provider, active)` | Link using short-lived single-use proof; encrypt sensitive channel metadata at rest; never store bot tokens here. |
| `ApiKey` | `id`, `userId`, `name`, `prefix`, `secretHash`, `scopes`, created/last-used/expiry/revocation timestamps | Unique `prefix`; `(userId, revokedAt)` | Display secret exactly once. Store only a keyed hash of the high-entropy secret; compare in constant time. Prefix is for lookup and must not authenticate by itself. |
| `ApiUsage` | `id`, `userId`, optional `apiKeyId`, request ID, route/method, status, units/latency, timestamp | `(userId, occurredAt)`; `(apiKeyId, occurredAt)`; retention/partitioning can be added if volume warrants it | Do not store request bodies, secrets, or sensitive query values. Apply a documented retention window and aggregate older records if required. |
| `ActivityLog` | `id`, `userId`, event type, safe metadata, request ID, timestamp | `(userId, occurredAt desc)`; event-type/time for investigation | Append-only to application roles; redact secrets and minimize personal data. Record security-relevant changes, not every read by default. |

## Justified supporting entities

- `UserRole` is required to implement the proposed `User`–`Role` many-to-many relationship with database-enforced uniqueness.
- `OutboxEvent` stores a typed event, aggregate ID, creation/dispatch time, retry count and status. It makes alert/notification enqueueing recoverable if the API commits a DB transaction but Redis is unavailable. Keep payloads minimal and versioned; consumers must be idempotent.
- A one-time bot-link challenge may be stored as a short-lived hashed token in a dedicated `AccountLinkChallenge` table or a tightly bounded Redis record. Prefer PostgreSQL when link completion must survive cache restart; delete/expire after use.

## Relationship sketch

`User` 1—N `Session`, `Watchlist`, `Alert`, `NotificationChannel`, `ApiKey`, `ApiUsage`, `ActivityLog`; `User` N—N `Role`; `Watchlist` 1—N `WatchlistItem`; alert changes may enqueue `OutboxEvent` records. Bot identities are represented by verified `NotificationChannel` rows, not by duplicate user accounts.

## Schema decisions to confirm before migrations

Confirm email verification/password-reset requirements, user deletion and retention behavior, whether teams/tenants are in scope, asset identifier semantics from MarketFeed, alert condition types/cooldowns, API key scopes/quotas, and channel-specific metadata/privacy requirements. Start without team/tenant tables unless collaboration is confirmed.
