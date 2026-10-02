import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";

// Run from the repository root. Never print the API key or signing secret.
async function setup() {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"))
    throw new Error("A Stripe test key is required in the local .env file.");
  let publicApi = process.env.BILLING_WEBHOOK_API_URL;
  if (!publicApi) {
    const response = await fetch("http://127.0.0.1:4040/api/tunnels", { signal: AbortSignal.timeout(3000) }).catch(
      () => null,
    );
    const state = response?.ok ? await response.json() : null;
    publicApi = state?.tunnels?.find(
      (tunnel) =>
        tunnel.public_url?.startsWith("https://") &&
        /(?:localhost|127\.0\.0\.1):4000\/?$/.test(tunnel.config?.addr ?? ""),
    )?.public_url;
  }
  if (!publicApi)
    throw new Error(
      "Start an HTTPS tunnel to API port 4000, then run pnpm billing:setup-webhook. Or set BILLING_WEBHOOK_API_URL to your HTTPS API origin.",
    );
  const api = new URL(publicApi);
  if (api.protocol !== "https:" || api.username || api.password || api.pathname !== "/" || api.search || api.hash)
    throw new Error("BILLING_WEBHOOK_API_URL must be an HTTPS API origin.");
  const ready = await fetch(new URL("/api/v1/health/ready", api), { signal: AbortSignal.timeout(10000) });
  if (!ready.ok) throw new Error("The public API is not ready. No webhook endpoint was created.");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 10000, maxNetworkRetries: 1 });
  const url = new URL("/api/v1/billing/webhook", api).href;
  if (process.env.STRIPE_WEBHOOK_ENDPOINT_ID && process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
    const registered = await stripe.webhookEndpoints.retrieve(process.env.STRIPE_WEBHOOK_ENDPOINT_ID);
    if (registered.livemode || registered.metadata.application !== "marketpilot")
      throw new Error("The configured endpoint is not a MarketPilot sandbox webhook.");
    if (registered.url !== url || registered.status !== "enabled")
      await stripe.webhookEndpoints.update(registered.id, { url, disabled: false });
    console.log("Existing Stripe sandbox webhook synchronized. Its signing secret is preserved.");
    return;
  }
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find(
    (endpoint) =>
      !endpoint.livemode &&
      endpoint.url === url &&
      endpoint.metadata.application === "marketpilot" &&
      endpoint.status === "enabled",
  );
  if (
    existing &&
    process.env.STRIPE_WEBHOOK_ENDPOINT_ID === existing.id &&
    process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")
  ) {
    console.log("Existing Stripe sandbox webhook is configured. Restart the API if its environment changed.");
    return;
  }
  if (existing)
    throw new Error(
      "A matching endpoint already exists but its local signing secret is unavailable. Recover its secret from Stripe before creating another endpoint.",
    );
  const endpoint = await stripe.webhookEndpoints.create({
    url,
    description: "MarketPilot sandbox billing",
    metadata: { application: "marketpilot" },
    enabled_events: [
      "checkout.session.completed",
      "checkout.session.expired",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
    ],
  });
  if (endpoint.livemode || !endpoint.secret)
    throw new Error("Only a sandbox webhook with a signing secret is supported.");
  const path = resolve(".env");
  const settings = { STRIPE_WEBHOOK_SECRET: endpoint.secret, STRIPE_WEBHOOK_ENDPOINT_ID: endpoint.id };
  let lines = readFileSync(path, "utf8").split(/\r?\n/);
  for (const [key, value] of Object.entries(settings)) {
    lines = lines.filter((line) => !line.startsWith(`${key}=`));
    lines.push(`${key}=${value}`);
  }
  writeFileSync(path, `${lines.filter((line, i) => line || i < lines.length - 1).join("\n")}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  console.log("Stripe sandbox webhook created. Signing secret saved only to local .env. Restart the API to load it.");
}
setup().catch((error) => {
  console.error(
    error instanceof Stripe.errors.StripeError
      ? "Stripe webhook setup failed. Check the test key and account permissions; provider details were suppressed."
      : error instanceof Error
        ? error.message
        : "Webhook setup failed.",
  );
  process.exitCode = 1;
});
