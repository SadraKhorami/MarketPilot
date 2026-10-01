import { randomUUID } from "node:crypto";
import { type Prisma } from "@marketpilot/db";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type Stripe from "stripe";
import { DatabaseService } from "../database.module";
import { EntitlementsService } from "./entitlements.service";
import { billingMode, StripeTestService } from "./stripe-test.service";

@Injectable()
export class StripeSubscriptionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
    private readonly provider: StripeTestService,
  ) {}
  async sync(userId: string, sessionId?: string) {
    return this.db.$transaction(
      async (tx) => {
        await this.entitlements.lock(tx, userId);
        const local = await tx.subscription.findUnique({ where: { userId } });
        if (!local?.stripeCustomerId) return;
        let subscriptionId = local.stripeSubscriptionId;
        let checkoutPaymentId: string | undefined;
        let checkoutInvoiceId: string | undefined;
        const checkoutId =
          sessionId ??
          (
            await tx.billingPayment.findFirst({
              where: { userId, provider: "STRIPE_TEST", stripeSessionId: { not: null }, status: "pending" },
              orderBy: { createdAt: "desc" },
            })
          )?.stripeSessionId;
        if (checkoutId) {
          const payment = await tx.billingPayment.findFirst({
            where: { userId, stripeSessionId: checkoutId, provider: "STRIPE_TEST" },
          });
          if (!payment) throw new NotFoundException("Checkout not found for this account.");
          const session = await this.provider.stripe.checkout.sessions.retrieve(checkoutId);
          if (session.livemode || session.client_reference_id !== userId || session.customer !== local.stripeCustomerId)
            throw new BadRequestException("Checkout ownership could not be verified.");
          if (session.status === "expired")
            await tx.billingPayment.update({ where: { id: payment.id }, data: { status: "expired" } });
          if (session.status !== "complete" || session.payment_status !== "paid") {
            if (sessionId) return;
          } else {
            const candidateId =
              typeof session.subscription === "string" ? session.subscription : (session.subscription?.id ?? null);
            if (subscriptionId && candidateId !== subscriptionId && payment.status !== "pending") return;
            subscriptionId = candidateId;
            checkoutPaymentId = payment.id;
            checkoutInvoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice?.id;
          }
        }
        if (!subscriptionId) return;
        const current = await this.provider.stripe.subscriptions.retrieve(subscriptionId);
        if (
          current.livemode ||
          current.customer !== local.stripeCustomerId ||
          current.metadata.marketpilotUserId !== userId
        )
          throw new BadRequestException("Subscription ownership could not be verified.");
        const item = current.items.data[0];
        const expected = await this.provider.price();
        if (current.items.data.length !== 1 || item?.price.id !== expected.id || item.quantity !== 1)
          throw new BadRequestException("Subscription does not match the Pro test plan.");
        const end = new Date(item.current_period_end * 1000);
        const active = current.status === "active" && end > new Date();
        const changed =
          local.status !== current.status ||
          local.plan !== (active ? "PRO" : "FREE") ||
          local.cancelAtPeriodEnd !== current.cancel_at_period_end;
        await tx.subscription.update({
          where: { userId },
          data: {
            provider: "STRIPE_TEST",
            stripeSubscriptionId: current.id,
            status: current.status,
            plan: active ? "PRO" : "FREE",
            currentPeriodEnd: end,
            cancelAtPeriodEnd: current.cancel_at_period_end,
          },
        });
        const invoices = await this.provider.stripe.invoices.list({ subscription: current.id, limit: 20 });
        for (const invoice of invoices.data) {
          if (invoice.livemode || invoice.customer !== local.stripeCustomerId) continue;
          const payment = await tx.billingPayment.findUnique({ where: { stripeInvoiceId: invoice.id } });
          const checkout =
            !payment && checkoutPaymentId && invoice.id === checkoutInvoiceId
              ? await tx.billingPayment.findUnique({ where: { id: checkoutPaymentId } })
              : null;
          const data = {
            status:
              invoice.status === "paid"
                ? "paid"
                : invoice.status === "void"
                  ? "void"
                  : invoice.status === "uncollectible" || (invoice.status === "open" && invoice.attempt_count > 0)
                    ? "failed"
                    : "pending",
            amountCents: invoice.status === "paid" ? invoice.amount_paid : invoice.amount_due,
            currency: invoice.currency,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            stripeInvoiceId: invoice.id,
            paidAt: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
          };
          if (payment || checkout) await tx.billingPayment.update({ where: { id: (payment ?? checkout)?.id }, data });
          else
            await tx.billingPayment.create({
              data: {
                ...data,
                userId,
                requestId: randomUUID(),
                provider: "STRIPE_TEST",
                createdAt: new Date(invoice.created * 1000),
              },
            });
        }
        if (changed)
          await this.audit(
            tx,
            userId,
            "BILLING_SUBSCRIPTION_SYNCED",
            `Stripe sandbox subscription is ${current.status}`,
          );
      },
      { timeout: 60000, maxWait: 10000 },
    );
  }

  async webhook(event: Stripe.Event) {
    if (billingMode() !== "stripe_test" || event.livemode)
      throw new BadRequestException("Only Stripe sandbox events are supported.");
    const supported = [
      "checkout.session.completed",
      "checkout.session.expired",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
    ];
    if (!supported.includes(event.type)) return;
    const object = event.data.object;
    if (!("customer" in object)) return;
    const customer = typeof object.customer === "string" ? object.customer : object.customer?.id;
    if (!customer) return;
    const local = await this.db.subscription.findUnique({ where: { stripeCustomerId: customer } });
    if (!local) return;
    const sessionId = event.type.startsWith("checkout.session.") && "id" in object ? object.id : undefined;
    await this.provider.safe(() => this.sync(local.userId, sessionId));
  }

  private async audit(tx: Prisma.TransactionClient, userId: string, eventType: string, description: string) {
    await tx.activityLog.create({ data: { userId, eventType, description } });
    await tx.notification.create({
      data: {
        userId,
        category: "ACCOUNT",
        title: "Test subscription updated",
        body: `${description}. Review your plan and allowances in Billing. This is a sandbox subscription; no real money was collected.`,
        actionPath: "/dashboard/billing",
      },
    });
  }
}
