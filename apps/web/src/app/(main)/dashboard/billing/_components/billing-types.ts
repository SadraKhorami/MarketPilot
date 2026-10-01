export interface PlanLimits {
  name: string;
  aiDaily: number;
  apiDaily: number;
  watchlists: number;
  watchlistItems: number;
  activeAlerts: number;
  apiKeys: number;
  externalAlerts: boolean;
}
export interface BillingOverview {
  mode: "demo" | "stripe_test" | "disabled";
  testOnly: boolean;
  plan: "FREE" | "PRO";
  plans: Record<"FREE" | "PRO", PlanLimits>;
  proTestPriceCents: number;
  subscription: {
    provider: "DEMO" | "STRIPE_TEST";
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: { ai: number; api: number; watchlists: number; activeAlerts: number; apiKeys: number };
  resetAt: string;
  providerSafetyBudget: string;
}
export interface PaymentRow {
  id: string;
  provider: "DEMO" | "STRIPE_TEST";
  status: string;
  amountCents: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  hostedInvoiceUrl: string | null;
  user?: { id: string; name: string | null; email: string };
}
export function testAmount(payment: Pick<PaymentRow, "provider" | "amountCents" | "currency">) {
  return payment.provider === "DEMO"
    ? "No charge"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency.toUpperCase() }).format(
        payment.amountCents / 100,
      );
}
