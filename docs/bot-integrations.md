# Telegram and Discord (Phase 6)

Both integrations use the existing Nest API, PostgreSQL, Redis/BullMQ and Phase 5 alert engine. `packages/bots` owns server-only transport, configuration, encryption, signature checks and safe text formatting. `apps/api/src/bots` shares account authorization and command application logic between platforms. The API consumes `bot-commands` so research calls use the existing `AiService`, budget, source validation, retention and proposal services. `apps/worker` consumes `external-notifications`; it does not call AI. RSS and dashboard inbox delivery remain independent. Customer API keys cannot manage links or invoke bot webhooks.

## Setup

Configure the root `.env` or production secret manager securely; never put populated credentials in browser variables, Git, logs or chat. `.env.example` contains placeholders only.

| Name | Purpose |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Server-side BotFather bot credential |
| `TELEGRAM_BOT_USERNAME` | Actual bot username without `@`; checked during setup/connectivity inspection |
| `TELEGRAM_WEBHOOK_SECRET` | Independent random 32–256 character secret using letters, digits, `_` or `-` |
| `DISCORD_BOT_TOKEN` | Server-side Discord bot credential |
| `DISCORD_APPLICATION_ID` | Actual Discord application ID |
| `DISCORD_PUBLIC_KEY` | Developer Portal Ed25519 verification public key, 64 hex characters |
| `BOT_PAYLOAD_KEY` | Independent random 32-byte AES-256-GCM key, 64 hex characters |
| `BOT_WEB_URL` | Dashboard origin without a path; HTTPS in production, local HTTP permitted in development |
| `BOT_API_URL` | Public HTTPS API base URL including `/api/v1`, used by the explicit setup script |

Apply migrations and build dependencies before starting the updated services:

```sh
pnpm install --frozen-lockfile
pnpm --filter @marketpilot/db migrate:deploy
pnpm --filter @marketpilot/db build
pnpm --filter @marketpilot/market-data build
pnpm --filter @marketpilot/ai build
pnpm --filter @marketpilot/jobs build
pnpm --filter @marketpilot/bots build
pnpm --filter @marketpilot/news build
pnpm --filter @marketpilot/api build
pnpm --filter @marketpilot/worker build
pnpm --filter @marketpilot/web build
```

Two additive migrations create bot records and command execution leases. They do not reset data or change existing alert crossing semantics. Run `pnpm dev` for development; use the existing API/worker start scripts after builds for production. The bot command worker starts within the API when at least one provider is configured. Expired command/link cleanup also runs when providers are unconfigured. Restart API and alert worker after changing bot environment settings; the setup CLI reloads `.env` on invocation. Stop services normally with SIGINT/SIGTERM so active work drains; API shutdown cancels active research through its AbortSignal.

Register only your configured bot/application, after the API is available:

```sh
pnpm bots:setup telegram
pnpm bots:setup discord
```

The explicit setup CLI verifies provider identity first. Telegram registers private-chat commands and `/api/v1/bot-webhooks/telegram`, preserving pending updates. Discord upserts only MarketPilot's named commands, preserving unrelated commands; it prints the URL to set in Developer Portal as the application's **Interactions Endpoint URL** (`/api/v1/bot-webhooks/discord`). Configure a public HTTPS reverse proxy that preserves request bodies and Discord signature headers. The signature check uses the unmodified raw body, Ed25519 public key, and a five-minute timestamp window. Invalid signatures return 401, including Discord's verification probes. Ensure the proxy/API clock is synchronized.

This implementation deliberately uses **HTTP webhooks in both development and production**, because both providers can share the existing authenticated API and durable command receiver. Local use needs an operator-provided HTTPS tunnel to the API and its public URL in `BOT_API_URL`; the dashboard may remain on localhost. No polling process or Gateway session is started, and existing polling/webhook deployments should be deliberately switched using the setup command. Do not run another polling process for this Telegram bot. Production requires an always-on API and worker, HTTPS ingress, database migrations, Redis persistence and secret configuration on every API/worker instance.

Install Discord from the dashboard's installation link; it requests the `bot` and `applications.commands` scopes with no elevated guild permissions. Open a private DM with the bot for `/link`; registered link commands are restricted to bot DM and the server also rejects guild linking. Other slash commands always defer/respond privately (`EPHEMERAL`). Allow the bot to send DMs for external alert notifications. Setup does not post announcements or send arbitrary test messages.

## Account linking and privacy

1. A signed-in browser session starts linking. The server generates 32 cryptographically random bytes and stores only SHA-256, owner, provider and a ten-minute expiry. A replacement attempt revokes earlier tokens. The raw link/code appears only in that response and browser memory, with `Cache-Control: no-store`.
2. Telegram accepts `/start TOKEN` only from an authenticated webhook carrying a private message with matching sender/chat IDs. Discord `/link code` binds the signed interaction's actual platform sender. No internal MarketPilot account ID is requested.
3. Redemption atomically consumes the token once. It records a **candidate**, granting no resource access. Expired, revoked, replayed or unavailable tokens receive generic guidance. Existing cross-account links are never silently reassigned.
4. The browser shows platform name and numeric identifier. The authenticated owner explicitly confirms that identity. Database uniqueness prevents a platform identity being claimed concurrently by different MarketPilot accounts. A leaked token can produce a candidate but cannot complete a link without the owner's browser confirmation; reject unfamiliar identities.
5. Market alerts default to **off** after linking/relinking. Enable them explicitly in Bots. Disconnect clears the destination/verification, revokes pending tokens, and suppresses queued eligible deliveries. Stored channel history is retained. Relinking creates a new verification timestamp, so older deliveries cannot target the new link, even with the same platform identity.

Link creation is limited to ten/hour per owner; redemption to five/hour per provider/sender; commands to twenty/minute per provider/sender. Limits are distributed through Redis and fail closed. A cheap per-process IP limit protects webhook ingress without blocking Discord acknowledgement on a Redis connection attempt. Platform event IDs are unique in the durable command inbox. Execution leases prevent concurrent processing after Redis loss; a crashed command lease expires after five minutes. Discord defers within a bounded acceptance path and edits the original ephemeral response, so response retries do not create extra followup messages.

Bot platform tokens, input, link codes and interim output are AES-GCM encrypted in `BotCommand`. Queue payloads contain record IDs only. Command records expire after ten minutes and are removed on cleanup; expired link hashes/candidates are removed after an additional day. Existing AI research remains retained by the seven-day AI policy. Retention cleanup resumes on API availability; TTL eligibility still applies during downtime. Rotating `BOT_PAYLOAD_KEY` makes existing encrypted commands unreadable; allow their short TTL to drain first or accept that they cannot be recovered. Preserve the old key only in an authorized secret-management procedure, never in Git.

Private resources and replies require an active user and the currently verified destination. Ownership is checked again before sending under user/channel locks; disconnect/disable serializes with the bounded provider call. An already accepted platform message cannot be recalled by disconnect. Deleted users lose their owned links/delivery rows and cannot redeem or access old research. The browser proposal decision endpoint remains session-only, owned, expiring and atomic. Bot commands cannot execute trades.

## Commands

| Telegram | Discord | Behavior |
| --- | --- | --- |
| `/start TOKEN`, `/help` | `/link code`, `/help` | Secure candidate linking and guidance; no private resources for unlinked senders |
| `/price BTC` | `/market symbol:BTC`, `/price symbol:BTC` | Validated observed quote/completed candle close, quote currency, source/instrument, observation/cache freshness, completed-history RSI/trend |
| `/analyze XAU-USD` | `/analyze symbol:XAU-USD` | Existing sourced research service with the account's research limits |
| `/ask QUESTION` or a private text question | `/ask question:QUESTION` | Existing sourced research; no direct provider bypass |
| `/watchlist 2` | `/watchlist page:2` | Linked owner's watchlists, eight/page, up to thirty symbols/list plus dashboard continuation |
| `/alerts 2` | `/alerts page:2` | Linked owner's enabled/paused rules, units, interval and actual last trigger; eight/page |

Catalog resolution accepts exact symbols, readable names and base aliases with an explicit USD preference (BTC → BTC-USD, gold/XAU → XAU-USD). Full quote symbols remain exact; BTCUSDT is not silently substituted. Unsupported/ambiguous symbols get actionable errors. Gold retains OANDA:XAUUSD provenance. Quotes can be older observations for inactive markets; bot output labels age/cache separately and never describes candle closes as live trades. Technical metrics use all returned completed history, independent of chart windows. Missing sentiment remains unavailable.

Research replies include a link to the owned AI Analyst conversation, source IDs/times and executed tools. Any alert proposal must be reviewed and confirmed there after signing in; a bot message is not an authorization to create a rule. Research has a ninety-second deadline and is cancelled on shutdown/disconnect detection. Recovered commands reuse persisted research request IDs and do not start another inference for an existing run. Telegram sends bounded HTML-formatted chunks with escaped text (up to six, below platform limits); Discord edits a bounded private embed with a full-research link. Only server-owned headings receive formatting; user/news/AI markup is escaped and mentions are disabled. Telegram shows a renewed typing indicator during linked market/research commands; Discord retains its native deferred-response loading state. Bot summaries show readable source names; full source identifiers, timestamps and evidence remain in AI Analyst. Discord linking uses the registered /link slash command in the bot’s private DM and its named code field, not a regular message in a server channel. News and AI text remain untrusted application data.

## Market alert outbox and delivery guarantees

The Phase 5 evaluator retains baseline → crossing, rearming and cooldown behavior. In the **same database transaction** as a new `AlertTrigger`, it snapshots verified, active, opted-in external destinations into `ExternalDelivery`. Unique `(triggerId, channelId, destination)` prevents duplicate internal delivery records. Old triggers are not retrospectively sent after enabling a channel. Dashboard `Notification.triggerId` and `AlertTrigger.deliveryStatus` continue to describe inbox delivery only; web opt-out or failure cannot suppress an external channel, and external outcomes never overwrite inbox state.

`external-notifications` recovers due rows every ten seconds, with up to 200 records/pass, two consumers/process and a distributed queue limit of one job per 1.1 seconds. Telegram/Discord command and alert sends share a distributed per-destination send slot. Before every send, the consumer checks current account status, enabled/owned rule, channel preference, destination and verification timestamp under locks. Paused/deleted rules, disconnection, relinking, or opt-out suppress pending delivery. Each channel gets its own status, attempt count, next retry, sanitized error and provider receipt.

Provider acceptance occurs outside the database's atomic boundary. The committed `sending` intent is written **before** contacting the provider; success then persists the receipt/status. Rate-limit responses respect provider `retry_after`, and definitive transient failures use bounded backoff. External records get at most five automatic attempts; queue infrastructure also has the existing bounded BullMQ budget. Retained exhausted failures await operator recovery. Failed queue reconciliation performs no direct provider send. Redis loss does not erase records or reset the database send-attempt budget.

**Exactly-once external delivery is not promised.** Telegram has no send-message idempotency key: network/5xx uncertainty or a crash after acceptance leads to `unknown`, with automatic resend stopped. This can lose a message that was never accepted, but avoids automatically repeating one that may have been sent. Discord uses a stable delivery nonce and `enforce_nonce` for recent-message deduplication. Ambiguous recovery is bounded to two minutes from the first send intent; the provider's recent nonce retention is not a contractual exactly-once guarantee, and duplicates remain possible. A later rejection or rate limit cannot erase uncertainty about an earlier attempt; its original recovery window is preserved. Beyond that window, a terminal rejection after uncertainty, or exhausted ambiguous attempts, status becomes `unknown`. Persisted receipt IDs describe confirmed provider acceptance, not that the user read the message.

Administration → System distinguishes configuration from actual recent worker heartbeats, inbound authenticated events, provider checks and successful sends. Connectivity checks only read provider identity and never send test messages. Delivery history displays sanitized errors and allows **definitive** failures to be retried up to three times with an audit entry and per-admin limits. Each manual retry uses a new queue generation, so retained older failed jobs cannot suppress recovery. Unknown acceptance and accepted receipts cannot be replayed through these controls. A retry rechecks eligibility, so it cannot revive a disconnected or disabled destination. Queue inspection hides encrypted command payloads, interaction tokens, raw provider errors and stack traces.

## Verification and limits

Automated tests and browser tabs were not run for Phase 6, per the user's instructions. Static lint, formatting, typecheck, build, migration application/status and schema drift checks are recorded with delivery. Local bot credentials and public ingress must be configured before validating real platform linking, slash registration/deadlines, provider delivery/rate limits or restart recovery end to end. Existing earlier CI success does not verify Phase 6. No real messages or paid inference calls were sent as development tests.

Daily summaries, sentiment-change subscriptions, group watchlist disclosure, trading, billing and deployment are outside this scope. Bots use the actual existing catalog/market/research availability; configuration badges are not proof of connectivity.

Official references inspected for this implementation: [Telegram Bot API](https://core.telegram.org/bots/api), [deep linking](https://core.telegram.org/bots/features#deep-linking), [Telegram limits](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this), [Discord signed interactions](https://docs.discord.com/developers/quick-start/getting-started), [private responses and deferral](https://docs.discord.com/developers/interactions/receiving-and-responding), [slash command registration/contexts](https://docs.discord.com/developers/interactions/application-commands), and [Discord message nonce/deduplication](https://docs.discord.com/developers/resources/message#create-message).
