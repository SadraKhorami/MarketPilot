import { HttpException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import Stripe from "stripe";

export const PRO_TEST_PRICE_CENTS = 1900;
export function billingMode(): "demo" | "stripe_test" | "disabled" {
  const mode = process.env.BILLING_MODE ?? "disabled";
  return mode === "demo" || mode === "stripe_test" ? mode : "disabled";
}

@Injectable()
export class StripeTestService {
  private client: Stripe | undefined;
  get stripe() {
    if (!this.client) {
      const key = process.env.STRIPE_SECRET_KEY?.trim();
      if (!key?.startsWith("sk_test_"))
        throw new ServiceUnavailableException({
          error: {
            code: "BILLING_UNAVAILABLE",
            message: "Stripe test billing is not configured. Live keys are not accepted.",
          },
        });
      this.client = new Stripe(key, { timeout: 10000, maxNetworkRetries: 1 });
    }
    return this.client;
  }
  async price() {
    const lookupKey = "marketpilot_pro_test_monthly_v1";
    const prices = await this.stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const existing = prices.data[0];
    if (existing) {
      if (
        existing.livemode ||
        existing.unit_amount !== PRO_TEST_PRICE_CENTS ||
        existing.currency !== "usd" ||
        existing.recurring?.interval !== "month" ||
        existing.recurring.interval_count !== 1
      )
        throw new ServiceUnavailableException("Stripe test price configuration is inconsistent.");
      return existing;
    }
    const product = await this.stripe.products.create(
      { name: "MarketPilot Pro — TEST ONLY", metadata: { application: "marketpilot", environment: "test" } },
      { idempotencyKey: "marketpilot-pro-test-product-v1" },
    );
    return this.stripe.prices.create(
      {
        product: product.id,
        unit_amount: PRO_TEST_PRICE_CENTS,
        currency: "usd",
        recurring: { interval: "month" },
        lookup_key: lookupKey,
      },
      { idempotencyKey: "marketpilot-pro-test-price-v1" },
    );
  }
  async safe<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({
        error: {
          code: "BILLING_PROVIDER_UNAVAILABLE",
          message: "Stripe test billing is temporarily unavailable. No plan change was made. Try again shortly.",
        },
      });
    }
  }
}
