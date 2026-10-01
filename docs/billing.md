# Test billing and subscriptions

Billing is deliberately **test only**. No live money is collected and the server rejects live Stripe keys. The displayed $19/month is a sandbox price, not approved commercial pricing. Production monetization, taxes, refunds, disputes and real provider onboarding remain separate work.

## Modes

- `BILLING_MODE=disabled` (default): plans and allowances are readable; subscription mutations are unavailable.
- `BILLING_MODE=demo`: a confirmed dashboard action creates a $0 demo activation and 30-day Pro access. It never auto-renews and requires no provider credentials.
- `BILLING_MODE=stripe_test`: Stripe-hosted sandbox Checkout creates a monthly test subscription. Set `STRIPE_SECRET_KEY=sk_test_...` only in the ignored local environment or server secrets. No publishable key is needed for the hosted redirect.

Never place credentials in `.env.example`, client environment variables or source control.

## Product surfaces

- `/dashboard/billing`: Overview, Plans, History. Current effective plan, period end, cancellation, daily usage, saved resource caps, test payment receipts.
- Account sidebar and profile menu link to Billing.
- `/dashboard/admin/payments`: account search, payment status filters, pagination, test transactions and subscription directory. ADMIN session required; API keys cannot access billing.
- Billing lifecycle events appear in the existing Activity/audit log, and subscription changes create account inbox notifications. Provider failures return safe messages; no card details are stored by MarketPilot.

## Allowances

| Resource | Free | Pro |
| --- | ---: | ---: |
| AI research / UTC day | 5 | 30 |
| Authorized API requests / UTC day | 100 | 10,000 |
| Watchlists | 2 | 10 |
| Assets per watchlist | 20 | 100 |
| Active alerts | 5 | 50 |
| Active API keys | 1 | 5 |
| Dashboard alert delivery | Yes | Yes |
| Telegram / Discord alert delivery | No | Yes |

Market, news and technical indicator views remain available on Free. Bot account linking and commands are not paywalled; commands that start AI research share the same daily AI allowance as the dashboard. Existing linked-account preferences are retained, but the worker rechecks Pro at delivery time.

The plan definitions live in `packages/db/src/plans.ts`. Capacity changes serialize on the user row; daily counters are persisted transactionally. AI quota is reserved together with creation of a new research run. Replay/recovery of an existing run does not consume another allowance. Failed/cancelled runs that began do count. Existing provider dollar budgets, per-minute throttling and concurrency safeguards remain independent. Pro does not override those safeguards.

API quota applies only to authenticated, scope-authorized developer-key requests admitted after rate limiting; browser, provider and internal bot requests do not consume API quota. An admitted request that subsequently returns an application error counts. API minute-rate headers remain separate from the daily plan allowance. Counters begin with this feature's installation and reset at 00:00 UTC; worker cleanup removes counters older than 90 days in batches of 500.

Downgrading retains saved data. Over-limit existing resources remain readable and can be edited, paused, revoked or removed; creation/reactivation must fit the effective plan. Existing active alerts keep dashboard delivery. External delivery is checked when an event is created and immediately before sending.

## Local setup

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
```

Set the desired mode in `.env`, then restart the API and worker. Demo works immediately with no keys. Stripe test Checkout initializes a clearly labeled test product and monthly price in the supplied Stripe sandbox on first use. It creates customers and sessions idempotently and never accepts a client-provided amount or plan.

### Stripe webhook setup

Expose **API port 4000**, not the frontend, using your existing HTTPS tunnel. With ngrok's local inspector available on port 4040:

```sh
pnpm billing:setup-webhook
```

The setup command verifies API readiness, creates a Stripe sandbox endpoint and saves its signing secret and ID directly in the ignored `.env` (mode 600). It never prints keys/secrets. Restart the API afterward. It reuses an existing configured endpoint rather than duplicating it. If using another tunnel, set `BILLING_WEBHOOK_API_URL=https://your-api-host` before running it. A changed temporary tunnel URL requires endpoint maintenance; stale endpoints can be disabled in Stripe. Telegram/Discord endpoints are not altered.

Alternatively, Stripe CLI forwarding can target `http://localhost:4000/api/v1/billing/webhook`. Save that listener's `whsec_...` secret to `STRIPE_WEBHOOK_SECRET` and restart the API. The CLI signing secret differs from a Dashboard endpoint's secret.

Accepted events: checkout completed/expired, subscription updated/deleted, invoice paid/payment_failed. Raw-body signature verification is mandatory. Live events are rejected. Repeated/out-of-order events retrieve current provider state under a user lock; invoice IDs are unique in the ledger. Unknown customers do not gain access. The webhook responds with failure for retry when synchronization fails.

### Checkout return and refresh

A success query parameter alone never activates Pro. The authenticated return handler verifies a locally owned checkout session, customer, subscription metadata, exact test price/quantity and current provider subscription state. Refresh status also recovers a pending checkout without the original redirect URL. Webhooks keep renewals and failures synchronized when the dashboard is closed. Without webhook forwarding, return/refresh still work, but unattended renewals/failures cannot synchronize automatically. Expired local Pro periods fail closed to Free until refreshed.

For the sandbox flow, use Stripe's [test cards](https://docs.stripe.com/testing), never a real payment method. Cancellation is scheduled at period end; resume removes that scheduled cancellation. Demo activations always expire after 30 days regardless of the cancellation toggle.

## Limitations and verification

- No real payments, production onboarding, tax calculation, refunds/disputes or self-service customer portal.
- Invoice synchronization imports the latest 20 invoices for the current subscription per refresh; this is a bounded sandbox flow, not a historical billing migration tool.
- Test payment amounts are never reported as live revenue.
- No existing account is automatically assigned Pro, and no user data is deleted on downgrade.
- Browser QA was not run, per the user's preference. All 87 existing automated tests passed; workspace formatting/type checks and API, worker and web production compilation succeeded.
- Disposable local accounts and Stripe sandbox customers verified hosted Checkout creation/idempotency, rejection of unpaid Checkout access, expiry, paid Pro activation, scheduled cancellation/resume, invoice replay and renewal invoice synchronization. Failed renewal removed Pro access, appeared as failed in the ledger, and replayed without duplicate invoices. Renewal invoices were explicitly finalized/paid through the Stripe sandbox API after advancing a test clock; this does not verify the browser Checkout form or automatic invoice finalization.
- A sandbox webhook endpoint was configured locally; raw-body signed requests (including an actual sandbox invoice event) reached the API through the public tunnel and returned 200. Unsigned requests returned 400. This verifies the handler/tunnel path; provider delivery retries are separate from manually replaying an event.
- Temporary verification accounts and test-clock customers were removed. The existing user's plan and data were not used for payment verification. Tunnel availability remains required for unattended webhook delivery.

References: [Stripe Checkout subscriptions](https://docs.stripe.com/payments/checkout/build-subscriptions), [Webhook signatures](https://docs.stripe.com/webhooks/signature), [Stripe test environments](https://docs.stripe.com/sandboxes).
