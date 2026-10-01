import { effectivePlan, type Prisma, plans } from "@marketpilot/db";
import { ConflictException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type Stripe from "stripe";
import { type PageQueryDto, pageResult } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
import { type PaymentsQueryDto } from "./billing.dto";
import { EntitlementsService } from "./entitlements.service";
import { StripeSubscriptionService } from "./stripe-subscription.service";
import { billingMode, PRO_TEST_PRICE_CENTS, StripeTestService } from "./stripe-test.service";

@Injectable()
export class BillingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
    private readonly provider: StripeTestService,
    private readonly subscriptions: StripeSubscriptionService,
  ) {}

  async overview(userId: string) {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const [subscription, usage, watchlists, activeAlerts, apiKeys] = await Promise.all([
      this.db.subscription.findUnique({ where: { userId } }),
      this.db.quotaUsage.findMany({ where: { userId, day } }),
      this.db.watchlist.count({ where: { userId } }),
      this.db.alert.count({ where: { userId, enabled: true } }),
      this.db.apiKey.count({
        where: { userId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      }),
    ]);
    const plan = effectivePlan(subscription, now);
    return {
      mode: billingMode(),
      testOnly: true,
      plan,
      plans,
      proTestPriceCents: PRO_TEST_PRICE_CENTS,
      subscription: subscription
        ? {
            provider: subscription.provider,
            status:
              subscription.currentPeriodEnd && subscription.currentPeriodEnd <= now ? "expired" : subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      usage: {
        ai: usage.find((row) => row.resource === "ai")?.count ?? 0,
        api: usage.find((row) => row.resource === "api")?.count ?? 0,
        watchlists,
        activeAlerts,
        apiKeys,
      },
      resetAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)),
      providerSafetyBudget:
        "Research also has separate provider spending and concurrency safeguards; Pro does not bypass them.",
    };
  }

  private enabled() {
    if (billingMode() === "disabled")
      throw new ServiceUnavailableException({
        error: { code: "BILLING_DISABLED", message: "Test billing is not enabled on this server." },
      });
  }

  async checkout(userId: string, requestId: string) {
    this.enabled();
    return this.entitlements.locked(userId, async (tx) => {
      const previous = await tx.billingPayment.findUnique({ where: { userId_requestId: { userId, requestId } } });
      if (previous) {
        if (previous.status === "pending" && previous.expiresAt && previous.expiresAt <= new Date())
          throw new ConflictException("This checkout expired. Start a new checkout.");
        return { paymentId: previous.id, url: previous.checkoutUrl, status: previous.status };
      }
      const existing = await tx.subscription.findUnique({ where: { userId } });
      if (
        effectivePlan(existing) === "PRO" ||
        (existing?.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(existing.status))
      )
        throw new ConflictException(
          "An existing subscription is active or needs attention. Refresh its status before starting another.",
        );
      if (billingMode() === "demo") {
        const end = new Date(Date.now() + 30 * 86400000);
        const payment = await tx.billingPayment.create({
          data: { userId, requestId, provider: "DEMO", status: "paid", amountCents: 0, paidAt: new Date() },
        });
        await tx.subscription.upsert({
          where: { userId },
          create: { userId, plan: "PRO", provider: "DEMO", status: "active", currentPeriodEnd: end },
          update: {
            plan: "PRO",
            provider: "DEMO",
            status: "active",
            currentPeriodEnd: end,
            cancelAtPeriodEnd: false,
            stripeSubscriptionId: null,
          },
        });
        await this.audit(tx, userId, "BILLING_DEMO_ACTIVATED", "Activated 30-day demo Pro; no money received");
        return { paymentId: payment.id, url: null, status: payment.status };
      }
      return this.provider.safe(async () => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
        let customerId = existing?.stripeCustomerId;
        if (!customerId) {
          const customer = await this.provider.stripe.customers.create(
            { email: user.email, metadata: { marketpilotUserId: userId } },
            { idempotencyKey: `marketpilot-test-customer:${userId}` },
          );
          if (customer.livemode) throw new ServiceUnavailableException("Live billing is disabled.");
          customerId = customer.id;
        }
        await tx.subscription.upsert({
          where: { userId },
          create: { userId, stripeCustomerId: customerId, provider: "STRIPE_TEST" },
          update: { stripeCustomerId: customerId },
        });
        const pending = await tx.billingPayment.findFirst({
          where: { userId, provider: "STRIPE_TEST", status: "pending", expiresAt: { gt: new Date() } },
        });
        if (pending?.checkoutUrl) return { paymentId: pending.id, url: pending.checkoutUrl, status: pending.status };
        const price = await this.provider.price();
        const base = new URL(
          "/dashboard/billing",
          process.env.WEB_ORIGIN?.split(",")[0]?.trim() || "http://localhost:3000",
        );
        const session = await this.provider.stripe.checkout.sessions.create(
          {
            mode: "subscription",
            customer: customerId,
            client_reference_id: userId,
            line_items: [{ price: price.id, quantity: 1 }],
            subscription_data: { metadata: { marketpilotUserId: userId } },
            success_url: `${base}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${base}?checkout=cancelled`,
            expires_at: Math.floor(Date.now() / 1000) + 1800,
          },
          { idempotencyKey: `marketpilot-test-checkout:${userId}:${requestId}` },
        );
        if (session.livemode || !session.url || new URL(session.url).hostname !== "checkout.stripe.com")
          throw new ServiceUnavailableException("Invalid test checkout.");
        const payment = await tx.billingPayment.create({
          data: {
            userId,
            requestId,
            provider: "STRIPE_TEST",
            amountCents: PRO_TEST_PRICE_CENTS,
            stripeSessionId: session.id,
            checkoutUrl: session.url,
            expiresAt: new Date(session.expires_at * 1000),
          },
        });
        await this.audit(tx, userId, "BILLING_CHECKOUT_STARTED", "Started Stripe sandbox checkout; no live payment");
        return { paymentId: payment.id, url: session.url, status: payment.status };
      });
    });
  }

  async reconcile(userId: string, sessionId?: string) {
    this.enabled();
    if (billingMode() === "demo") return this.overview(userId);
    await this.provider.safe(() => this.subscriptions.sync(userId, sessionId));
    return this.overview(userId);
  }

  async cancellation(userId: string, cancelAtPeriodEnd: boolean) {
    this.enabled();
    await this.db.$transaction(
      async (tx) => {
        await this.entitlements.lock(tx, userId);
        const local = await tx.subscription.findUnique({ where: { userId } });
        if (
          !local ||
          (effectivePlan(local) !== "PRO" &&
            (!local.stripeSubscriptionId || ["canceled", "incomplete_expired"].includes(local.status)))
        )
          throw new ConflictException("There is no active test subscription to update.");
        if (local.cancelAtPeriodEnd === cancelAtPeriodEnd) return;
        if (local.provider === "STRIPE_TEST") {
          const stripeSubscriptionId = local.stripeSubscriptionId;
          if (billingMode() !== "stripe_test" || !stripeSubscriptionId)
            throw new ConflictException("This subscription needs Stripe test billing enabled.");
          await this.provider.safe(() =>
            this.provider.stripe.subscriptions.update(stripeSubscriptionId, {
              cancel_at_period_end: cancelAtPeriodEnd,
            }),
          );
        }
        await tx.subscription.update({ where: { userId }, data: { cancelAtPeriodEnd } });
        await this.audit(
          tx,
          userId,
          cancelAtPeriodEnd ? "BILLING_CANCELLATION_SCHEDULED" : "BILLING_CANCELLATION_REVERSED",
          cancelAtPeriodEnd
            ? "Scheduled test Pro cancellation at the end of this period"
            : "Kept test Pro active through its current period",
        );
      },
      { timeout: 30000 },
    );
    return this.overview(userId);
  }

  async payments(userId: string, query: PageQueryDto) {
    const [items, total] = await Promise.all([
      this.db.billingPayment.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: paymentSelection,
      }),
      this.db.billingPayment.count({ where: { userId } }),
    ]);
    return pageResult(items, total, query);
  }

  async adminPayments(query: PaymentsQueryDto) {
    const where: Prisma.BillingPaymentWhereInput = {
      ...(query.status !== "all" ? { status: query.status } : {}),
      ...(query.search?.trim()
        ? {
            user: {
              OR: [
                { email: { contains: query.search.trim(), mode: "insensitive" } },
                { name: { contains: query.search.trim(), mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.billingPayment.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: { ...paymentSelection, user: { select: { id: true, name: true, email: true } } },
      }),
      this.db.billingPayment.count({ where }),
    ]);
    return pageResult(items, total, query);
  }

  async adminSubscriptions(query: PageQueryDto) {
    const where: Prisma.SubscriptionWhereInput = query.search?.trim()
      ? {
          user: {
            OR: [
              { email: { contains: query.search.trim(), mode: "insensitive" } },
              { name: { contains: query.search.trim(), mode: "insensitive" } },
            ],
          },
        }
      : {};
    const [items, total] = await Promise.all([
      this.db.subscription.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { userId: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          userId: true,
          plan: true,
          status: true,
          provider: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          user: { select: { name: true, email: true } },
        },
      }),
      this.db.subscription.count({ where }),
    ]);
    return pageResult(
      items.map((row) => ({ ...row, effectivePlan: effectivePlan(row) })),
      total,
      query,
    );
  }

  async adminSummary() {
    const [payments, paid, pending, activePro] = await Promise.all([
      this.db.billingPayment.count(),
      this.db.billingPayment.count({ where: { status: "paid" } }),
      this.db.billingPayment.count({
        where: { status: "pending", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      }),
      this.db.subscription.count({ where: { plan: "PRO", status: "active", currentPeriodEnd: { gt: new Date() } } }),
    ]);
    return { payments, paid, pending, activePro, liveRevenueCents: 0, testOnly: true };
  }

  webhook(event: Stripe.Event) {
    return this.subscriptions.webhook(event);
  }

  private async audit(tx: Prisma.TransactionClient, userId: string, eventType: string, description: string) {
    await tx.activityLog.create({ data: { userId, eventType, description } });
    if (eventType !== "BILLING_CHECKOUT_STARTED")
      await tx.notification.create({
        data: {
          userId,
          category: "ACCOUNT",
          title: "Test subscription updated",
          body: `${description}. Review your plan in Billing. No real money was collected.`,
          actionPath: "/dashboard/billing",
        },
      });
  }
}
const paymentSelection = {
  id: true,
  provider: true,
  status: true,
  amountCents: true,
  currency: true,
  paidAt: true,
  createdAt: true,
  hostedInvoiceUrl: true,
} satisfies Prisma.BillingPaymentSelect;
