# Administration and developer API

## Boundaries

- `/api/v1/admin/*` requires an authenticated `ADMIN` browser session. Global backend role and scope guards enforce this independently of sidebar visibility and the frontend gate. Even an administrator’s API key cannot call these routes.
- User pages show the current account’s keys, activity and preferences. Account, request and credential administration remains read-only; announcement management is described in [notification center](notification-center.md). No role changes, account disabling, impersonation or billing mutations were added.
- The API catalog is the source for creation scopes, endpoint documentation and the actual per-key rate limit. Supported reads: `market:read` → market price/candles/indicators/trend, `news:read` → paginated sourced articles, `watchlists:read` and `alerts:read` → owner resources. Existing keys are not granted new scopes automatically.
- No AI, email delivery, Telegram, Discord or billing implementation was added. In-app notifications are implemented separately. Future phases in the supplied document informed page boundaries only; OpenRouter remains the planned AI provider.

## Request accounting

`ApiUsage.authType` persists `SESSION` or `API_KEY`. The migration backfills existing rows from their key association. Key revocation keeps history; deleting a key does not change the historical authentication classification.

A response-finish middleware records authenticated request metadata, including 403/429 guard rejections. It does not store bodies, query strings, cookies, authorization headers or credentials. Anonymous traffic and health probes are excluded. Administrative monitoring therefore covers recorded authenticated traffic, not every network request.

User Usage filters every count, latency aggregate, UTC daily series and recent-request query by account, `API_KEY`, date range and optional owner-checked key. Revoked keys remain selectable. Never-created credentials show an onboarding state instead of browser usage. UTC day buckets include zero-count days in the selected range.

Limits: 120 requests/minute per key, 300/minute per browser account, and 10 login/register attempts/minute per IP. Logout remains available. Redis outage fallback is per process and does not provide a distributed limit across replicas. Retention/archival policy remains open.

## UI structure

- Reference: Desktop `next-shadcn-admin-dashboard` users table/pagination, finance chart composition and profile header/status layout. Adapted with existing primitives and semantic tokens; no runtime dependency on the reference checkout.
- Administration uses server-paginated search/filter tables, safe account-detail sheets, actual traffic/endpoint charts and explicit capability status.
- Account Activity groups real events by date with debounced search, date ranges and pagination. Notifications use an explicit save action; appearance reuses the persisted preference store. Settings navigation uses a compact select on narrow screens.
- New feature components are colocated with their routes. Shared identity, resource-state handling, filters and pagination live outside the admin feature because user pages also reuse them. Local `components/ui` primitives remain intact.

## Provisioning

The requested additional administrator was provisioned in the local database with bcrypt hashing. Its password is absent from source, migrations and seed defaults. Existing accounts were preserved. Reproducible deployments continue using environment-based administrator bootstrap with strong new-password validation.

## Verification (2026-09-30)

- `pnpm run ci`: lint, formatting, typecheck, 42 automated tests, and all production builds passed. Two existing web lint warnings remain in unrelated alert/dashboard files; changed files introduce none.
- Actual HTTP checks against PostgreSQL/Redis: ADMIN/USER boundaries for every admin endpoint, anonymous news rejection, working market/news key reads, wrong scopes, account/key ownership, key-only accounting (including 403), revoked-key history, invalid pagination/scopes and logout.
- Browser: ordinary user visibility/direct-route redirect, key creation form, activity search/empty state, persisted notification preferences, sessions, administrator login, users/detail/role filter, request pagination, audit, keys, system, payments and API documentation. Desktop dark/light and 375px mobile layouts inspected. Temporary verification data was removed.
- Visual evidence: `docs/screenshots/admin-refresh/`. Payments and other future integrations remain intentionally unavailable.

## Phase 4 AI operations

Administration → System displays seven-day AI run states, tool counts, input/output tokens, average latency, reported provider cost and conservative budget reservations. These are actual server metadata, never private questions/answers or invented billing. `GET /ai/metrics` requires an ADMIN browser session. All `/ai/*` endpoints deny developer API keys even if the owner is an administrator; existing read scopes and API-key Usage are unchanged. Browser request records remain in Administration. Details and endpoint contracts are in [AI Analyst](ai-analyst.md).
