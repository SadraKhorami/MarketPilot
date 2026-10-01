# Production and staging runbook (Phase 8)

Deployment artifacts are prepared; no server, domain, registry, TLS certificate or production rollout has been provisioned. Phase 9, payments and subscriptions are outside this change. The currently running development services, ngrok tunnel and webhook registrations must be preserved until an operator explicitly authorizes cutover.

## Processes and build boundaries

The actual processes are Next.js web, NestJS API (including private bot command consumers), and a background worker (market refresh, alert evaluation, inbox delivery, independent Telegram/Discord delivery and optional RSS ingestion). There is no separate bot daemon. PostgreSQL is authoritative; Redis holds cache, rate limits, BullMQ schedules and short-lived runtime observations.

`docker/Dockerfile` has `web`, `api`, `worker` and an operator-only `migrate` target. Node **24.20.0** and pnpm **10.26.0** match `.node-version`, the package manager declaration and CI. App runners use Debian slim, OpenSSL/CA certificates and the non-root `node` user. Optional tooling peers (Prisma CLI/TypeScript) are excluded from API/worker deployments; required runtime dependencies and the explicitly generated Prisma engine remain. Toolchains and development dependencies stay in build stages; the migration target separately retains the Prisma CLI. pnpm's frozen lockfile controls dependency versions. `pnpm deploy --legacy --prod --no-optional --frozen-lockfile` makes self-contained API/worker workspaces, and packaging explicitly copies the Linux-generated Prisma client/engine into the deployed dependency graph. Builders and runners must use the same architecture/libc; never copy a macOS client or bcrypt binary into Linux.

Next uses standalone tracing from the monorepo root. Static assets and `public` are copied explicitly. `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_APP_URL` are build arguments embedded in the browser bundle and metadata; changing runtime environment variables cannot change them. Build separate web images for staging and production. They must be stable public HTTPS URLs, **not** `http://api:4000`, localhost or a temporary tunnel. Turbo includes both values in the build cache key. No production credentials are build arguments. `.dockerignore` excludes local environments, keys, dependency trees, caches, test artifacts, docs and working files; attribution/license files remain in the context and images.

Versions are deliberately pinned. Before rollout, review dependency advisories, OS patches and image release notes, rebuild with `--pull`, and record the resulting immutable image digests/revision. A version tag can be rebuilt upstream; a successful build alone does not establish vulnerability freedom. Use digest-identified artifacts for releases and rollback. Existing local infrastructure images/data are unchanged.

## Configuration matrix

Copy the templates in `docker/` to a protected directory **outside this checkout**. Limit file permissions to the operator account (`0600`), keep that directory outside Docker contexts, and use a secret manager where the hosting platform supplies one. Compose local file secrets are mounted files, not an encrypted vault. Do not print expanded `compose config`, environment dumps, connection URLs or secrets into logs/chat.

| Setting | Consumer / time | Requirement and behavior |
| --- | --- | --- |
| `NODE_ENV` | API/worker runtime; web build/runtime | `production` for both staging and production. Development uses `.env.example`; `test` is reserved for CI. |
| `DATABASE_URL` | API/worker/migration runtime | PostgreSQL URL with percent-encoded credentials; use `postgres:5432` for this stack and the DB/user matching Compose. Production requires a non-default password. Configure `connection_limit`, `pool_timeout` and `connect_timeout` for the number of processes and database capacity. External managed DB connections require the provider's verified TLS configuration. |
| `REDIS_URL` | API/worker runtime | `redis://:ENCODED_PASSWORD@redis:6379/0`; password must match the mounted Redis secret. Use `rediss://` for external TLS Redis. Production rejects missing/default passwords. Use a separate instance per environment. |
| `POSTGRES_DB`, `POSTGRES_USER` | Compose initialization | Explicit names. This bundled PostgreSQL image initializes a privileged owner; for an Internet production service provision separate migration/runtime DB roles, grant only needed schema/table rights, and use different URLs in each env file. App startup upserts application roles, so runtime credentials need access to the `Role` table. |
| `POSTGRES_PASSWORD_FILE`, `REDIS_PASSWORD_FILE` | Compose secret paths | Files outside the repo. Use randomly generated passwords; Redis template requires at least 32 base64url/hex characters. PostgreSQL password initialization applies only to a new volume; changing a file does not rotate an existing database password. |
| `WEB_ORIGIN` | API runtime | Comma-separated exact HTTPS dashboard origins, no path/trailing slash/wildcards/credentials. Required in production. Staging must not allow production origins by accident. |
| `TRUST_PROXY` | API runtime | `false` (default) or a comma-separated **source IP/CIDR** allowlist. No boolean-all or hop-count trust. Use the actual proxy address seen by the API; a host proxy may appear as the Docker gateway, not `127.0.0.1`. Never trust broad untrusted networks. |
| `NEXT_PUBLIC_API_URL` | Web **build** / Compose interpolation | Public HTTPS API base including exactly `/api/v1`. Not a secret. |
| `NEXT_PUBLIC_APP_URL` | Web **build** / Compose interpolation | Public HTTPS dashboard origin. Not a secret. |
| `API_HOST`, `API_PORT` | API runtime | Local defaults `0.0.0.0:4000`; production Compose fixes these for the image probe. |
| `WORKER_HEALTH_HOST`, `WORKER_HEALTH_PORT` | Worker runtime | Local default `127.0.0.1:4100`; Compose uses `0.0.0.0:4100` inside the private network and never publishes this port. Separate direct local worker processes need distinct probe ports. |
| `COMPOSE_PROJECT_NAME` | Compose | Required isolated name, e.g. `marketpilot-staging` or `marketpilot-production`; isolates networks/volumes. |
| `WEB_BIND_PORT`, `API_BIND_PORT` | Compose host loopback | Defaults `8080`, `8081`. Check availability before starting; staging and production on one host need distinct ports. No database/Redis host ports. |
| `API_ENV_FILE`, `WORKER_ENV_FILE`, `MIGRATION_ENV_FILE` | Compose file paths | Protected files outside build context. Web receives no runtime secrets; worker receives no AI key; migration receives only its DB URL. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | API runtime only | Optional as a complete pair. Production fails on partial configuration. Model capabilities/live availability are validated per research request; no automated paid calls. |
| `OPENROUTER_BASE_URL` | API runtime | Only `https://openrouter.ai/api/v1` is accepted. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | API/worker runtime | Optional integration. If the token is present, all Telegram/shared configuration must be valid at production startup. Username and 32–256 character webhook secret are validated. |
| `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `DISCORD_PUBLIC_KEY` | API/worker runtime | Optional integration. If the token is present, all Discord/shared configuration must be valid. Signed interactions use the raw request bytes; do not transform webhook JSON at the proxy. |
| `BOT_PAYLOAD_KEY` | API/worker runtime | Independent random 32-byte key expressed as 64 hex characters. Required for enabled bots. Preserve during restarts/restores; do not casually rotate while encrypted commands exist. |
| `BOT_WEB_URL` | API/worker runtime | Stable HTTPS dashboard origin for enabled bots. Use the same origin as the built web image. |
| `BOT_API_URL` | Explicit operator setup command only | Stable HTTPS API URL including `/api/v1`; needed when registering webhooks. Does not configure browser API hosting. |
| `NEWS_INGESTION_ENABLED` | API/worker runtime | Defaults false. Enable only after source-use permission. |
| `NEWS_REFRESH_INTERVAL_SECONDS` | Worker runtime | Default 900; whole seconds, 300–86400. |
| `INVESTING_RSS_FEEDS_JSON` | Worker runtime | Approved feeds only; `[]` in production template. See integrations/news documentation for source constraints. |
| `ALERT_REFRESH_SECONDS` | Worker/API runtime | Default 60, range 30–3600; job configuration must agree across consumers. |
| `ALERT_REFRESH_CONCURRENCY` | Worker/API runtime | Default 2, range 1–3; global refresh concurrency is established by the worker. |
| `ALERT_EVALUATION_CONCURRENCY`, `ALERT_NOTIFICATION_CONCURRENCY` | Worker/API runtime | Defaults 4 each, ranges 1–16. |
| `ALERT_PROVIDER_JOBS_PER_MINUTE` | Worker/API runtime | Default 20, range 1–60; includes dispatcher jobs. |
| `ALERT_QUOTE_MAX_AGE_SECONDS`, `ALERT_SNAPSHOT_MAX_AGE_SECONDS` | Worker/API runtime | Defaults 120 each, ranges 30–600. |
| `ALERT_JOB_ATTEMPTS` | Worker/API runtime | Default 5, range 1–10; bounded retries/backoff remain in place. |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | Existing local seed only | Leave empty in examples. **Never run the development seed/reset as a production deploy step.** Provision the first production administrator through reviewed operator access, granting ADMIN to an explicitly verified registered account; do not create default credentials. |

Keep alert job settings consistent in the API and worker env files when overriding defaults: the API also creates queues for commands and recovery. Optional capabilities remain honestly unavailable when unconfigured. Readiness does not make AI or market-provider requests.

## Explicit deployment sequence

Requires Docker Engine, Compose v2-compatible CLI and Buildx/BuildKit. Some macOS installations expose Compose as `docker-compose`; use that equivalent if the Docker CLI plugin is absent. The commands below are operator steps and were **not** executed to launch this stack.

1. Select the host, capacity, firewall policy, separate staging/production domains and TLS/reverse proxy. Confirm ports and inspect the intended Compose project/volumes; never reuse the current development project or attach its data volumes accidentally.
2. Configure the protected Compose env file, three service env files and two secret files. Keep staging data/credentials isolated. Supply public build settings and match all internal credentials. Back up an existing target database before any migration.
3. Validate without printing secrets; build the app/tool targets explicitly:

   ```sh
   docker compose --env-file /secure/marketpilot-staging/compose.env -f compose.production.yaml --profile tools config --quiet
   docker compose --env-file /secure/marketpilot-staging/compose.env -f compose.production.yaml --profile tools build --pull api worker web migrate
   ```

4. Start **only the target** infrastructure. For production, provision separate runtime/migration DB roles through reviewed administrative access, set the protected URLs, and configure runtime default/table privileges for the migration owner before allowing app traffic. Then apply migrations as a one-shot operation. If migration fails, stop the rollout and inspect the migration ledger; never reset, edit applied SQL, auto-resolve or seed to bypass it.

   ```sh
   docker compose --env-file /secure/marketpilot-staging/compose.env -f compose.production.yaml up -d --wait postgres redis
   docker compose --env-file /secure/marketpilot-staging/compose.env -f compose.production.yaml --profile tools run --rm migrate
   ```

5. Start the app services after successful migration. Configure the reverse proxy and verify origin/session behavior before allowing users in. `depends_on` handles initial dependency readiness; subsequent outages appear in health probes and the system page. Docker marks unhealthy containers but does **not** restart them merely because a healthcheck failed; configure operator monitoring/alerts, and use liveness for automatic restarts so dependency failures do not cause restart storms.

   ```sh
   docker compose --env-file /secure/marketpilot-staging/compose.env -f compose.production.yaml up -d --wait api worker web
   docker compose --env-file /secure/marketpilot-staging/compose.env -f compose.production.yaml ps
   ```

6. Provision the administrator, inspect Administration → System, then validate staged registration/login/logout, role and scope boundaries, alerts, retry/restart behavior and backups using deliberate operator scenarios. Real bot messages or AI research require separate authorization. Promote only after CI/container and staging runtime checks pass; record image digests and migration revision. A source rollback is safe only when the migrated schema is backward compatible; otherwise recover to a separately restored environment and plan a reviewed forward fix.

The auxiliary `migrate` profile is excluded from ordinary `up`. No migration, reset, seed, webhook registration, credential rotation, image push or deployment happens in image entrypoints or CI. The additive Phase 8 cleanup-index migration (`20261001150000_operational_cleanup_indexes`) adds expiry indexes for global bot token/command cleanup. Index creation can temporarily block table writes; stage it and schedule a maintenance window for large existing tables. Bot cleanup runs at most once per minute in batches of up to 500 records per table rather than deleting an unbounded collection every recovery tick.

Existing migration order includes `20260930200000_alert_engine`; preserve the ledger in backups and do not rename applied migrations during deployment.

## TLS, origins and proxy trust

Use stable sibling HTTPS origins such as `app.example.com` and `api.example.com` so the host-only HTTP-only `SameSite=Lax; Secure` session cookie works with credentialed API requests. Cross-site custom domains need a separate reviewed cookie/CSRF design; do not weaken this policy to make a deployment work. `WEB_ORIGIN` is the dashboard allowlist, not the webhook hostname. Production writes with a browser Origin must match the explicit allowlist. Cookie-authenticated writes missing Origin are rejected; originless bearer/server/webhook clients retain their own authentication. A supplied bearer header cannot inherit a browser session, and API scopes/session-only/admin guards remain enforced.

`docker/nginx.conf.example` is a host-proxy template, not an installed server. Replace domains/certificate paths/ports, set the actual proxy source IP/CIDR in `TRUST_PROXY`, run `nginx -t`, and review before an authorized reload. The proxy replaces forwarding headers rather than trusting client values, rate-limits before expensive authentication and preserves webhook bytes and SSE. Only it should reach the loopback app bindings. If using a proxy container or managed ingress, adapt the private networking and exact proxy allowlist instead of exposing app ports broadly. Add host firewall restrictions and platform CPU/memory/connection budgets appropriate to capacity; this Compose does not claim capacity sizing or managed database privileges are solved.

API JSON/form bodies are limited to 128 KiB, form parameters to 100, headers to a ten-second receive deadline and request bodies to fifteen seconds. Existing bounded Redis/local request limits, distributed bot/AI admission and queue limits remain intact. Redis outages expose local rate-limit mode to API-key callers; that fallback is per process, not a distributed guarantee. Public probes bypass ordinary request buckets and return only status/timestamp or a stable generic error. Never use public probes to disclose URLs, credentials or queue topology.

The current ngrok tunnel is **development-only** API ingress for Telegram/Discord inbound webhooks on port 4000. It is not customer API hosting. Do not stop it, replace its URL, or register new webhooks until cutover is explicitly authorized. At that point use stable public URLs, the existing deliberate setup procedure in [bot integrations](bot-integrations.md), and platform identity/signature checks. An API/worker restart or Compose build never registers webhooks.

## Health and diagnosis

| Probe / view | Meaning |
| --- | --- |
| Web `/health` | The web process can respond; does not establish API/provider readiness. |
| API `/api/v1/health` | API liveness; no dependency calls. |
| API `/api/v1/health/ready` | Actual Postgres `SELECT 1` and Redis `PING`, each bounded at 2.5 seconds; returns 503 for unavailable dependencies or draining. |
| Private worker `/health` | Worker process/probe is responding. No public port in Compose. |
| Private worker `/health/ready` | Database and Redis respond, four alert/delivery consumers run with ready Redis connections and unpaused queues, and shutdown has not started. No provider call. |
| Administration → System | Authorized dependency latency, queue counts/failures, ready worker counts, per-stage consumers and last observed completed/failed jobs, independent bot/runtime and AI information. |

Workers publish per-instance records every 15 seconds with a 90-second TTL; ready counts and admin records use a 45-second freshness window. Redis outages stop fresh records and become unavailable; DB failure makes the worker unready. Queue failures/pauses, no recent workers or incomplete telemetry make alert processing degraded. Recent failures remain visible even after a later completion. Up to 50 recent worker snapshots are inspected per request. An old worker from before Phase 8 can have a legacy heartbeat but no stage records, so upgrade all target workers before expecting full telemetry. Job timestamps describe observations in that process lifetime; durable failure/history counts and delivery records remain separate.

A heartbeat or completed dispatch job is **not** proof of fresh market data, matched rules, successful inbox writes or provider acceptance. Retained exhausted jobs and provider errors still need inspection. A `completed` external job may have scheduled a later retry or suppressed an ineligible destination; inspect the independent delivery records/receipt in bot administration. Exactly-once external delivery is not promised: never blindly resend `unknown` acceptance. Keep the Phase 5/6 durable outbox, bounded retries and idempotency behavior documented in [alert engine](alert-engine.md) and [bot integrations](bot-integrations.md).

Structured API logs include request ID, route template, method, status, latency and internal user ID where authenticated. They omit raw query strings, paths for unmatched routes, request bodies, cookies, bearer tokens, prompts, linking codes and raw provider/client exceptions. Nginx should log `$uri`, not `$request_uri`, and never headers/bodies containing credentials. Operators can correlate `X-Request-Id` with authenticated request history; the proxy template replaces client-supplied IDs. Background logs include job/worker/queue identifiers, latency and sanitized failure events/codes. Docker logs rotate at 10 MiB × 3 per service; configure an authorized central collector and retention/alert policy before launch. Persisted request history is separate and needs an operator-approved retention policy; Phase 8 does not silently delete audit records.

Common diagnosis:

- **API startup failed:** verify required setting names and service-role grants without dumping values; confirm migrations, generated native client and compatible image. Framework startup errors are suppressed to avoid leaking connection strings. Detailed underlying stack traces are intentionally not logged.
- **Ready 503 / unready worker:** check target Postgres/Redis health, credentials/DNS/TLS, pool exhaustion and paused consumers. Monitor Redis memory/AOF disk and PostgreSQL capacity; probe deadlines bound responses but do not cancel an already-started client query.
- **Redis reachable, queue inspection unavailable:** queue operations have a separate five-second deadline; do not infer that a Redis PING failed from a queue timeout. The system page keeps this distinction visible.
- **No recent stage timestamps:** idle work may have no successful jobs yet. Check actual rules/outboxes and queue counts; do not fabricate a success event or send an unsolicited bot message as a probe.
- **Provider failure/stale observations:** use actual alert reasons and retained jobs. Provider availability is checked when work runs, not inferred from process health.
- **Login/origin/rate-limit errors behind proxy:** verify sibling HTTPS URLs, baked public settings, exact `WEB_ORIGIN`, cookie attributes and proxy source trust/header replacement. Rebuild the web image when public URLs change.
- **Shutdown:** SIGTERM/SIGINT drain alert/news work and bot consumers before closing pools. Compose gives app processes 60 seconds; worker logs a failure and exits nonzero at its 55-second deadline rather than pretending an incomplete drain succeeded. Inspect unknown external acceptance after interrupted sends.

## Backup, restore and recovery

Define and rehearse RPO/RTO, encrypted storage, access restrictions and retention before using production. Backups contain account data and encrypted command payloads; protect the associated bot encryption key separately. Never place dumps in this repository or image context.

Example logical PostgreSQL backup (operator command, no credentials printed):

```sh
# /secure/backups must already exist with restricted permissions.
umask 077
docker compose --env-file /secure/marketpilot-production/compose.env -f compose.production.yaml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /secure/backups/marketpilot.dump
```

Restore only into a **new isolated project with an empty database**, leaving original volumes intact. Start that project's Postgres, keep API/workers stopped, inspect the backup inventory and restore with explicit exit-on-error:

```sh
docker compose --env-file /secure/marketpilot-restore/compose.env -f compose.production.yaml exec -T postgres sh -c 'pg_restore --exit-on-error --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /secure/backups/marketpilot.dump
```

Verify the migration ledger/data under operator access, run the appropriate migration revision, then start only the isolated application and rehearse recovery. Dumps do not preserve external roles/passwords: provision those separately. Never use `down -v`, `migrate reset`, unreviewed `--clean`/drop commands or a development seed to recover production.

Redis uses a durable volume, AOF with `appendfsync everysec` and `maxmemory-policy noeviction` for BullMQ. Monitor memory/disk rather than silently evicting jobs; size memory/capacity on the chosen host. A crash may still lose the most recent AOF second. Rehearse volume backups/restores during controlled maintenance using the Redis image's documented AOF/RDB procedure; do not copy a changing AOF directory and assume consistency. PostgreSQL outboxes recover persisted events after queue loss; restarting workers recreates schedules. Redis restoration can lose rate buckets and job history; it must not reset database attempt budgets or trigger automatic replay of ambiguous external acceptance. Validate repaired delivery records manually in the authorized admin flow.

## Dependency advisory review

The Phase 8 audit identified two transitive findings. The scoped `@nestjs/swagger>js-yaml` override pins **5.4.1**, correcting [GHSA-r3ph-w7gj-g6xm](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm) without changing the Swagger API or upgrading unrelated dependencies. The follow-up frozen installation selects this version without upgrading unrelated dependencies.

The remaining Prisma tooling finding, `deepmerge-ts` [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), is corrected by a scoped `@prisma/config>deepmerge-ts` override to **8.0.0**. Prisma itself stays at the existing version. Prisma configuration loading, client generation, schema validation and migration deployment succeeded with the patched dependency. A fresh lockfile audit reports zero known vulnerabilities at verification time; this is not a guarantee against future advisories. Scan final images before rollout.

The follow-up installed Buildx locally and applied the two additive cleanup indexes to the development database without resetting data. Production/staging databases still require the explicit operator migration step.

## CI and verification boundary

CI retains existing tests and Postgres migration application. Distinct steps use frozen installation, Prisma generation, formatting, lint, typecheck, tests and production build. A dependent matrix builds all four Docker targets without publishing. It needs no production secrets, bot credentials or paid AI key. Actions are commit-pinned, permissions are `contents: read`, concurrency cancels superseded runs, and only a push to main exports the trusted container cache; PRs cannot write that cache. No `pull_request_target`, auto-deployment or registry login is introduced.

Local verification does not run/add automated tests or open browser tabs, per the user's instructions. Inspect the Phase 8 delivery record for checks actually completed; container build/runtime, restart recovery, webhook delivery and TLS behavior require the stated staging/operator checks. Existing Phase 7 CI success does not establish Phase 8 CI success.

## References and attribution

The dashboard remains adapted from [next-shadcn-admin-dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard), with [third-party notices](../THIRD_PARTY_NOTICES.md) and `apps/web/LICENSE` retained. Relevant raw metric/card, toolbar/table and chart composition was inspected; the reference checkout is not a runtime dependency.

Technical references: [Next standalone tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [Next public environment values](https://nextjs.org/docs/app/guides/environment-variables), [pnpm Docker](https://pnpm.io/docker), [pnpm deploy](https://pnpm.io/cli/deploy), [Prisma Linux requirements](https://docs.prisma.io/docs/orm/reference/system-requirements), [Express proxy trust](https://expressjs.com/en/guide/behind-proxies/), [BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production), [Docker CI builds](https://docs.docker.com/build/ci/github-actions/), [PostgreSQL version policy](https://www.postgresql.org/support/versioning/) and [PostgreSQL backup/restore](https://www.postgresql.org/docs/16/backup-dump.html). Installed Next documentation was inspected before web/config changes.

### Verified packaging follow-up

The container build exposed a legacy offline deployment failure. Packaging now uses the dedicated deployment lockfile (`pnpm deploy` without `--legacy`) with workspace injection enabled and build synchronization. Dependency versions remain pinned by the frozen root lockfile; no offline metadata resolution or unreviewed range upgrades are required. The pnpm GitHub Action pin was also corrected to a verified v4 commit.

### Local follow-up verification

All four production targets (`api`, `worker`, `web`, `migrate`) were built and loaded successfully with Buildx on Linux arm64. The web build now tolerates the optional `public` directory being absent. A temporary isolated Docker network/database ran the migration image against an empty database, then API, worker and standalone web readiness probes succeeded under read-only app filesystems, dropped capabilities and non-root application users. Temporary containers/network were removed. Existing user services, data and webhook registrations were not used for these checks.

Formatting, lint, typecheck, production source builds, Prisma generation/schema validation, Compose validation and the lockfile audit succeeded. Existing lint warnings remain. The dependency audit reported zero known vulnerabilities. No automated test suite, browser inspection, real bot messages or paid AI calls were run. This does not establish x86_64 runtime, TLS/ingress behavior, full application interactions, provider delivery, backup restore or GitHub CI success for the uncommitted revision. GitHub CI still runs after an authorized push.
