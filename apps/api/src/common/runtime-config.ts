import { isIP } from "node:net";
import { botConfiguration, botProviders } from "@marketpilot/bots";
import { jobConfig, validateRuntimeEnvironment } from "@marketpilot/jobs";

export function webOrigins() {
  return (process.env.WEB_ORIGIN ?? "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function validateApiConfiguration() {
  validateRuntimeEnvironment();
  jobConfig();
  const port = Number(process.env.API_PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid configuration: API_PORT");
  const mode = process.env.BILLING_MODE ?? "disabled";
  if (!["disabled", "demo", "stripe_test"].includes(mode)) throw new Error("Invalid configuration: BILLING_MODE");
  if (mode === "stripe_test" && !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"))
    throw new Error("Invalid configuration: STRIPE_SECRET_KEY (test keys only)");
  if (process.env.STRIPE_WEBHOOK_SECRET && !process.env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_"))
    throw new Error("Invalid configuration: STRIPE_WEBHOOK_SECRET");
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.WEB_ORIGIN?.trim() || !webOrigins().length) throw new Error("Missing configuration: WEB_ORIGIN");
  for (const origin of webOrigins()) {
    try {
      const url = new URL(origin);
      if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password) throw new Error();
    } catch {
      throw new Error("Invalid configuration: WEB_ORIGIN");
    }
  }
  const proxy = process.env.TRUST_PROXY;
  if (proxy && proxy !== "false") {
    for (const entry of proxy.split(",")) {
      const [address, prefix, extra] = entry.trim().split("/");
      const family = isIP(address);
      if (
        !family ||
        extra !== undefined ||
        (prefix !== undefined &&
          (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (family === 4 ? 32 : 128)))
      )
        throw new Error("Invalid configuration: TRUST_PROXY");
    }
  }
  if (process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_MODEL) {
    if (
      !process.env.OPENROUTER_API_KEY?.trim() ||
      !process.env.OPENROUTER_MODEL?.trim() ||
      (process.env.OPENROUTER_BASE_URL && process.env.OPENROUTER_BASE_URL !== "https://openrouter.ai/api/v1")
    )
      throw new Error("Invalid configuration: OPENROUTER");
  }
  for (const provider of botProviders) {
    const enabled = provider === "TELEGRAM" ? process.env.TELEGRAM_BOT_TOKEN : process.env.DISCORD_BOT_TOKEN;
    const config = botConfiguration(provider);
    if (enabled && !config.configured)
      throw new Error(`Invalid configuration: ${[...config.missing, ...config.invalid].join(", ")}`);
  }
}
