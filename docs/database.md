# Database Model

PostgreSQL is authoritative. The implemented Prisma schema and initial migration live in `packages/db/prisma`. Models use UUID primary keys, UTC timestamps, explicit ownership foreign keys, and database constraints for invariants. Asset identifiers remain normalized strings; no MarketFeed-specific fields are assumed.

Phase 3 adds `NewsArticle` as provider-owned normalized news metadata. It stores the original URL and a unique SHA-256 canonical URL hash, source, title/description as supplied, publication/retrieval timestamps, language, source categories, and deterministic affected asset symbols. `publishedAt/source`, `category/publishedAt`, and `fetchedAt` have B-tree indexes; affected assets use a PostgreSQL GIN index. The future classification columns (`category`, `priority`, `impactScore`, `classificationConfidence`, `classifiedAt`) remain nullable and are not populated in Phase 3. Market observations remain in Redis only; PostgreSQL is not used to retain provider prices in this phase.

## Core entities

| Entity | Important fields and relationships | Indexes / constraints | Security and lifecycle |
|---|---|---|---|
| `User` | `id`, lowercase unique `email`, `passwordHash`, `name`, `status`, timestamps; owns sessions and product records | Unique email; `(status, createdAt)` | Passwords use bcrypt cost 12 and are limited to 72 UTF-8 bytes; no plaintext password is stored. Registration assigns `USER`. |
| `Role` / `UserRole` | `Role.name` is `ADMIN` or `USER`; join rows connect users and roles | Unique role name; composite `(userId, roleId)` primary key and reverse lookup index | Seeded roles are server-controlled. `UserRole` foreign keys cascade on deletion. |
| `Session` | `userId`, unique SHA-256 `tokenHash`, expiry, last-seen, revocation, creation timestamps | Unique token hash; `(userId, expiresAt)` and `expiresAt` | API issues random opaque tokens in an HTTP-only cookie with a 14-day expiry; only the hash is stored. Logout and per-session revoke invalidate it. |
| `Watchlist` | `userId`, `name`, timestamps; owns `WatchlistItem` rows | Unique `(userId, name)`; `(userId, updatedAt)` | User ownership is included in read/write queries. Deleting a user cascades to its lists. |
| `WatchlistItem` | `watchlistId`, normalized string `assetId`, `position`, creation time | Unique `(watchlistId, assetId)`; `(watchlistId, position)` | Deleting the list cascades to its items. Asset values are product identifiers, not provider-validated symbols yet. |
| `Alert` | `userId`, name, asset ID, typed condition enum, decimal threshold, enabled flag, cooldown, evaluation/trigger timestamps | `(userId, enabled, createdAt)`; `(enabled, assetId)` | All operations scope by owner. CRUD is active; background evaluation and notification delivery are not implemented. |
| `NotificationChannel` | `userId`, provider enum (`WEB`, `TELEGRAM`, `DISCORD`), external account, verification/active state, JSON preferences, timestamps | Unique `(provider, externalAccountId)` and `(userId, provider)`; `(userId, active)` | Current registration creates an active WEB preference row. Bot linking is not implemented; never store bot tokens in this model. |
| `ApiKey` | `userId`, name, unique lookup prefix, SHA-256 `secretHash`, string scopes, last-used/expiry/revocation/creation timestamps | Unique prefix; `(userId, revokedAt, createdAt)` | High-entropy secret is returned once and never stored. Prefix is 24 characters; scope checks guard API-key reads. |
| `ApiUsage` | `userId`, optional `apiKeyId`, request ID, route/method/status/latency, occurrence time | `(userId, occurredAt)`, `(apiKeyId, occurredAt)`, request ID | Stores request metadata only, no request bodies or credentials. Retention policy remains to be set. |
| `ActivityLog` | `userId`, event type, description, safe JSON metadata, optional request ID, occurrence time | `(userId, occurredAt)`, `(eventType, occurredAt)` | Records registration, sign-in, watchlist, alert, API-key, and profile changes. User deletion cascades to its activity. |

## Justified supporting entities

- `UserRole` is required to implement the proposed `User`–`Role` many-to-many relationship with database-enforced uniqueness.
- `OutboxEvent` is deferred until a worker/notification pipeline is implemented. It should store a typed event, aggregate ID, creation/dispatch time, retry count, and status so queue publication can be recovered.
- A one-time bot-link challenge may be stored as a short-lived hashed token in a dedicated `AccountLinkChallenge` table or a tightly bounded Redis record. Prefer PostgreSQL when link completion must survive cache restart; delete/expire after use.

## Relationship sketch

`User` 1—N `Session`, `Watchlist`, `Alert`, `NotificationChannel`, `ApiKey`, `ApiUsage`, `ActivityLog`; `User` N—N `Role`; `Watchlist` 1—N `WatchlistItem`; alert changes may enqueue `OutboxEvent` records. Bot identities are represented by verified `NotificationChannel` rows, not by duplicate user accounts.

## Remaining data decisions

Confirm email verification/password-reset requirements, user deletion and retention behavior, whether teams/tenants are in scope, asset identifier semantics from MarketFeed, alert evaluation/cooldown rules, API key scopes/quotas, and channel-specific metadata/privacy requirements. Start without team/tenant tables unless collaboration is confirmed.
