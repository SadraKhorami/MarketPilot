# Developer API (Phase 7)

## Setup and boundaries

The existing API serves developer reads at `/api/v1`. Configure server `API_HOST`, `API_PORT`, `REDIS_URL`, `DATABASE_URL` and browser `NEXT_PUBLIC_API_URL` / `WEB_ORIGIN` as described in `.env.example`. Secrets stay in server configuration. No Phase 7 database migration, reset, additional provider credentials, billing or deployment is required. Apply existing migrations for a fresh installation. The bot webhook tunnel is ingress for platform events, not provisioned customer API hosting.

Create keys from Dashboard → API keys with a name and explicit read permissions. The secret is returned once, with `Cache-Control: no-store`. Only a SHA-256 hash and a random display/lookup prefix are stored. The credential contains a 256-bit secret and 64-bit prefix. Creation/revocation and their audit events commit atomically; security notifications are best-effort. Save the secret before dismissing the notice. Creation is disabled while another new secret is displayed. Revoking clears that notice when applicable and retains request history. Rotation means creating a replacement with the required scopes, switching your integration and explicitly revoking the old key; there is no secret recovery.

List responses contain `id`, `name`, `prefix`, `scopes`, `createdAt`, `lastUsedAt`, `expiresAt`, `revokedAt`, never `secretHash` or full credentials. Last-used means successful authentication, including requests subsequently rejected for scope or rate. Revocation stops future authentication; an already authenticated in-flight read may finish. Creation has no expiration selector; existing expiration timestamps are still enforced. Existing keys are never granted additional scopes automatically.

Send `Authorization: Bearer YOUR_API_KEY`. An explicit bearer credential is evaluated independently of a browser cookie. Keys cannot authenticate as a browser session, including keys belonging to administrators. All unscoped routes and writes reject keys, including account/key management, research, linking and administration. ADMIN sessions alone can view global requests and key inventory; users see owned keys and resources only.

`apps/api/src/api-keys/api-catalog.ts` is the source of creation scope choices, endpoint descriptions and key rate limits. Swagger at `/api/v1/docs` and JSON at `/api/v1/openapi.json` include browser operations too; their authentication schemes distinguish session-only routes from supported developer reads. The catalog enriches the eight supported GET operations with required scopes, parameters and response descriptions.

## Supported reads

Paths below are relative to `/api/v1`; there is no separate indicators or sentiment endpoint.

| Method / path | Required scope | Parameters | Response inside `data` |
| --- | --- | --- | --- |
| GET `/market-data/catalog` | `market:read` | None | `instruments`, `fetchedAt`, `stale`, `error`, `connections` |
| GET `/market-data/{symbol}` | `market:read` | Symbol from catalog; `interval`: `1m`, `5m`, `15m` (default), `1h`, `6h`, `1d` | `{ source, requestedSymbol, freshness, fetchedAt, data: observation }` |
| GET `/news` | `news:read` | `search` ≤120 chars, `asset` ≤80, `category` ≤100, `page`, `pageSize` | `{ articles, total, page, pageSize, totalPages, refreshState, sentiment: null, assetFilter }` |
| GET `/watchlists` | `watchlists:read` | None | Array of owned watchlists and their ordered items |
| GET `/alerts` | `alerts:read` | `search` ≤120 chars; `status`: `all` (default), `active`, `paused`; `page`, `pageSize` | `{ items, total, page, pageSize, totalPages }` |
| GET `/alerts/summary` | `alerts:read` | None | `{ total, active, paused }` |
| GET `/alerts/{id}` | `alerts:read` | Owned alert UUID | Owned rule including evaluation state; 404 for absent/unowned ID |
| GET `/alerts/{id}/history` | `alerts:read` | Owned alert UUID; `page`, `pageSize` | `{ items, total, page, pageSize, totalPages }` |

Pagination is one-based, defaults to page 1 and 20 rows, and allows 1–50 rows. Alerts/history cap page at 100000; news requires a positive integer. `totalPages` is 0 for an empty collection. Out-of-range pages return an empty collection. Alert history also accepts the shared `search` parameter but does not apply it. Unknown query fields are rejected. Retrieve owned IDs from list responses rather than guessing them.

## Data meaning

All successes use `{ "data": … }`. Market snapshots have a nested observation: `body.data.data.price`, `body.data.data.indicators`, `body.data.data.candles`. Price uses the catalog instrument's quote currency; `priceKind` distinguishes a trade quote from a candle close. `timestamp` is observation time and `fetchedAt` is retrieval time. Candles are oldest-first and bounded to 300. Null indicators indicate insufficient history, not zero. Unknown volume or market-open status remains null.

A cache entry can be fresh for 60 seconds after retrieval; stale provider fallback is explicitly labeled and retained up to 15 minutes. Fresh cache status is not a promise of real-time exchange prices. Inspect source, provider symbol and observation time. TradingView access is an unofficial configured adapter; upstream availability and exchange delay vary. Catalog `connections.multiAsset = configured` is not evidence of a successful live read. Crypto discovery can be partial/stale with a reported `error`. See [integration semantics](integrations.md).

News returns original source links, publication/fetch timestamps and ingestion status. Empty results are valid when authorized ingestion is disabled. Asset filtering uses stored tags and keyword matching, not proven financial impact. Sentiment is unavailable (`null`); no scope or working endpoint advertises it. Alert trigger history reflects observed triggers, not proof that an external notification was delivered/read. This API provides no trading or billing functions.

## Examples

Use the dashboard guide to select any supported endpoint and copy a curl, Node.js or standard-library Python example. `YOUR_ALERT_ID` is a placeholder for an owned UUID; `BTC-USD` is an example catalog identifier. Code examples never contain stored secrets and do not send requests from the guide itself.

Bash, with the credential entered privately and removed from the shell variable afterwards:

```bash
read -r -s -p "API key: " MP_API_KEY; echo
curl --fail-with-body 'http://localhost:4000/api/v1/market-data/BTC-USD?interval=15m' \
  -H "Authorization: Bearer $MP_API_KEY"
unset MP_API_KEY
```

Node.js, with `MP_API_KEY` securely supplied by your environment/secret manager:

```js
const key = process.env.MP_API_KEY;
if (!key) throw new Error('Set MP_API_KEY securely first.');
const response = await fetch('http://localhost:4000/api/v1/news?asset=BTC-USD&page=1&pageSize=20', {
  headers: { Authorization: `Bearer ${key}` },
});
const body = await response.json();
if (!response.ok) {
  const retry = response.headers.get('Retry-After');
  throw new Error(`${body.error?.message ?? response.status}${retry ? `; retry in ${retry}s` : ''}`);
}
console.log(body.data.articles); // Never print the key.
```

Python 3, using only the standard library:

```python
import getpass, json, urllib.request, urllib.error
key = getpass.getpass('API key: ')
request = urllib.request.Request(
    'http://localhost:4000/api/v1/alerts?page=1&pageSize=20',
    headers={'Authorization': 'Bearer ' + key},
)
try:
    with urllib.request.urlopen(request, timeout=30) as response:
        print(json.load(response)['data']['items'])
except urllib.error.HTTPError as error:
    body = json.load(error)
    print(error.code, body.get('error', {}).get('message'))
    if error.code == 429:
        print('Retry after', error.headers.get('Retry-After'), 'seconds')
```

Use HTTPS on a configured public host. Keep keys out of browser code, version control, logs and persistent client storage. Examples display only response data, not authorization headers. Invalid/unowned resources and external failures must be handled explicitly.

## Rate limits and errors

API keys get 120 requests per 60-second fixed window independently of browser accounts (300/minute). Login and registration each have a separate 10/minute IP bucket. Logout stays accessible after browser exhaustion. Authentication happens before the per-key limit; invalid/revoked credentials receive 401 and are not associated with an owner's usage. Successfully authenticated requests count against their key even when scope/role/validation subsequently rejects them.

Redis atomically increments the key bucket, creates its TTL only on first use and reads remaining TTL in one transaction. Key-authenticated responses expose:

| Header | Meaning |
| --- | --- |
| `X-RateLimit-Limit` | Requests allowed per window |
| `X-RateLimit-Window` | Window length in seconds |
| `X-RateLimit-Remaining` | Allowed requests left at this response, clamped to 0 |
| `X-RateLimit-Reset` | Conservative window-reset Unix timestamp in seconds |
| `X-RateLimit-Mode` | `redis`, or `local` during Redis outage |
| `Retry-After` | Seconds to wait on 429 |
| `X-Request-Id` | Correlation ID for the request/error |

CORS exposes these headers to allowed origins. Remaining/reset describe a current key bucket, not account quota or billing. Concurrent traffic can consume the remaining allowance. Redis failure uses bounded per-process memory, not distributed limits; replicas and process restarts have independent fallback buckets. Recovery returns to the Redis bucket. When local capacity is exhausted, new identities receive 429 with a conservative 60-second retry and no invented key-bucket metadata. Do not rely on fallback as a distributed production quota.

Illustrative error (retry value comes from the actual bucket):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 120
X-RateLimit-Window: 60
X-RateLimit-Remaining: 0
X-RateLimit-Mode: redis

{"error":{"code":"RATE_LIMITED","message":"Too many requests. Retry in 42 seconds.","retryAfterSeconds":42},"requestId":"…"}
```

Errors use `{ "error": { "code", "message", "retryAfterSeconds"? }, "requestId" }`. 400 validation reports `VALIDATION_ERROR`; unsupported symbols use `MARKET_INVALID_SYMBOL` or `MARKET_UNSUPPORTED_SYMBOL`. 401 uses `UNAUTHENTICATED`, and keys lacking a scope/session-only access get 403 `API_SCOPE_REQUIRED` (role checks can return `FORBIDDEN`). Missing owned resources return 404. Market/provider outages return 503 (for example `MARKET_UNAVAILABLE`) unless an explicitly stale cached observation is available. Unexpected 500 errors hide internal details. Wait for `Retry-After` on 429 rather than immediately retrying; retain request IDs for support.

## Usage and operational limits

The response-finish middleware records only authenticated HTTP requests: owner, key ID, `authType`, request ID, route pattern, method, status, server response time in milliseconds and timestamp. No query strings, bodies, authorization headers, cookies or credentials enter usage records. Browser traffic is `SESSION`; customer key traffic is `API_KEY`. Internal domain calls from providers/workers/bots do not create developer usage. Real authenticated 403/429/validation/server failures are included; invalid credentials, anonymous traffic and health probes are excluded. Requests aborted before response finish and metadata writes that fail are not captured. This is observed request reporting, not billing-grade metering.

`GET /api-keys/usage` is session-only. It accepts `days` (1–90; default 7), optional owner-checked `keyId`, `page` (1–100000; default 1) and `pageSize` (1–50; default 20). Counts, latency, UTC daily series, rate-limit count and request pages apply the same owner/`API_KEY`/key/time filters. The window starts at midnight UTC of the first selected day and ends at the reported `period.until`; today is partial. Empty days are filled with zero observed requests. `recent` remains the response array for compatibility and is now paginated, with root `page`, `pageSize`, `totalPages`, `totalRequests`. Revoked keys remain selectable and retain history. No keys/usage shows onboarding rather than dashboard traffic.

Request IDs, status, route, readable key name/prefix, UTC timestamps and millisecond latency support investigation. Developer usage excludes browser activity across all metrics. Administration retains global authenticated request/key oversight and audit history. Persistence is asynchronous and may appear shortly after a response. Retention/archival, expiry creation controls and production hosting remain future work; no Phase 8 changes are included.

## Verification (2026-10-01)

The following checks passed for API and web:

- `pnpm exec turbo run lint format:check typecheck --filter=@marketpilot/api --filter=@marketpilot/web`
- `pnpm exec turbo run build --filter=@marketpilot/api --filter=@marketpilot/web`
- `git diff --check`

Shared prerequisite builds were reused from the Turbo cache. Web lint reports three existing warnings in unrelated research/dashboard files; changed files introduce none. Automated tests, real external requests, paid inference and browser tabs are deliberately not used for this phase. Existing key/rate-limit fixtures were adapted to changed contracts for subsequent CI; this does not mean tests passed. Browser visual quality, live Redis fallback/headers, mixed-cookie/bearer behavior and the full integration flow remain unverified end to end under the user's verification restrictions.
