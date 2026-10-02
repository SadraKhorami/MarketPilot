import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";
import { parseEnv } from "node:util";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const localDir = resolve(root, ".local");
export const statusPath = resolve(localDir, "dev-status.json");
export const envPath = resolve(root, ".env");
export function environment() {
  if (!existsSync(envPath)) throw new Error("Create .env from .env.example and fill in local settings first.");
  return { ...process.env, ...parseEnv(readFileSync(envPath, "utf8")) };
}
export function localEnvironment(env) {
  if (env.NODE_ENV === "production") throw new Error("dev:full is for development only.");
  for (const key of ["DATABASE_URL", "REDIS_URL"]) {
    let url;
    try {
      url = new URL(env[key]);
    } catch {
      throw new Error(`Set ${key} in .env.`);
    }
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      throw new Error(`${key} must point to this computer before using dev:full.`);
  }
  if (Number(env.API_PORT ?? 4000) !== 4000) throw new Error("dev:full currently requires API_PORT=4000.");
}
export function saveEnvironment(settings) {
  let lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const [key, value] of Object.entries(settings)) {
    lines = lines.filter((line) => !new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line));
    lines.push(`${key}=${JSON.stringify(value)}`);
  }
  const temporary = `${envPath}.dev-tmp`;
  writeFileSync(temporary, `${lines.join("\n").trimEnd()}\n`, { mode: 0o600 });
  renameSync(temporary, envPath);
  chmodSync(envPath, 0o600);
}
export function run(command, args, { quiet = false, env = environment(), timeout = 120000, signal } = {}) {
  return new Promise((resolveResult, reject) => {
    if (signal?.aborted) {
      reject(new Error("Local startup cancelled."));
      return;
    }
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: quiet ? ["ignore", "pipe", "ignore"] : "inherit",
      detached: process.platform !== "win32",
    });
    const terminate = () => {
      try {
        if (process.platform === "win32") child.kill("SIGTERM");
        else if (child.pid) process.kill(-child.pid, "SIGTERM");
      } catch {
        /* Already stopped. */
      }
    };
    const cancel = () => {
      terminate();
      reject(new Error("Local startup cancelled."));
    };
    signal?.addEventListener("abort", cancel, { once: true });
    let output = "";
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    const timer = setTimeout(() => {
      terminate();
      reject(new Error(`${command} timed out.`));
    }, timeout);
    child.once("error", () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      reject(new Error(`${command} is unavailable. Install it and retry.`));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (code === 0) resolveResult(output.trim());
      else reject(new Error(`${command} failed. Review the preceding output or run it directly.`));
    });
  });
}
export async function json(url, init = {}) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(5000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
export async function ready(url) {
  const data = await json(url);
  return ["ok", "ready"].includes(data?.data?.status);
}
export function portOpen(port) {
  return new Promise((done) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (open) => {
      socket.destroy();
      done(open);
    };
    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}
export async function tunnel() {
  const state = await json("http://127.0.0.1:4040/api/tunnels");
  return (
    state?.tunnels?.find((item) => {
      try {
        const url = new URL(item.public_url);
        return url.protocol === "https:" && /(?:localhost|127\.0\.0\.1):4000\/?$/.test(item.config?.addr ?? "");
      } catch {
        return false;
      }
    })?.public_url ?? null
  );
}
export async function snapshot() {
  const env = environment();
  localEnvironment(env);
  const workerPort = Number(env.WORKER_HEALTH_PORT ?? 4100);
  const [api, worker, web, docker, publicUrl] = await Promise.all([
    ready("http://127.0.0.1:4000/api/v1/health/ready"),
    ready(`http://127.0.0.1:${workerPort}/health/ready`),
    fetch("http://127.0.0.1:3000", { signal: AbortSignal.timeout(5000), redirect: "follow" })
      .then((r) => r.ok)
      .catch(() => false),
    run("docker", ["compose", "ps", "--format", "json"], { quiet: true, timeout: 5000 }).catch(() => ""),
    tunnel(),
  ]);
  let containers = [];
  try {
    containers = docker.startsWith("[")
      ? JSON.parse(docker)
      : docker
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
  } catch {
    /* Unknown Docker status remains unavailable. */
  }
  const service = (id, label, ok, detail) => ({ id, label, status: ok ? "ready" : "attention", detail });
  const publicReady = Boolean(publicUrl) && (await ready(`${publicUrl}/api/v1/health/ready`));
  const needsTunnel = Boolean(env.TELEGRAM_BOT_TOKEN || env.DISCORD_BOT_TOKEN || env.BILLING_MODE === "stripe_test");
  const statuses = [
    service(
      "postgres",
      "PostgreSQL",
      containers.some((item) => item.Service === "postgres" && item.Health === "healthy"),
      containers.some((item) => item.Service === "postgres" && item.Health === "healthy")
        ? "Local database container healthy"
        : "Run dev:full or inspect docker compose ps",
    ),
    service(
      "redis",
      "Redis",
      containers.some((item) => item.Service === "redis" && item.Health === "healthy"),
      containers.some((item) => item.Service === "redis" && item.Health === "healthy")
        ? "Local queue container healthy"
        : "Run dev:full or inspect docker compose ps",
    ),
    service(
      "api",
      "Application API",
      api,
      api ? "Database and Redis reachable" : "Start dev:full or inspect API output",
    ),
    service("worker", "Background jobs", worker, worker ? "Worker queues ready" : "Inspect worker output"),
    service("web", "Dashboard", web, "http://localhost:3000"),
    {
      id: "tunnel",
      label: "API tunnel",
      status: !publicUrl && !needsTunnel ? "not_configured" : publicReady ? "ready" : "attention",
      detail: publicUrl
        ? publicReady
          ? "Public API reachable"
          : "Public API unreachable; check ngrok and network"
        : needsTunnel
          ? "Start dev:full to open an ngrok tunnel to port 4000"
          : "Optional until bot or Stripe credentials are configured",
    },
  ];
  const expectedBase = publicUrl ? `${publicUrl}/api/v1` : null;
  const configured = (id, label, enabled, ok, detail) => ({
    id,
    label,
    status: !enabled ? "not_configured" : ok ? "ready" : "attention",
    detail,
  });
  const [telegram, discord, stripe] = await Promise.all([
    env.TELEGRAM_BOT_TOKEN ? json(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`) : null,
    env.DISCORD_BOT_TOKEN
      ? json("https://discord.com/api/v10/applications/@me", {
          headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
        })
      : null,
    env.BILLING_MODE === "stripe_test" &&
    env.STRIPE_SECRET_KEY?.startsWith("sk_test_") &&
    env.STRIPE_WEBHOOK_ENDPOINT_ID
      ? json(`https://api.stripe.com/v1/webhook_endpoints/${encodeURIComponent(env.STRIPE_WEBHOOK_ENDPOINT_ID)}`, {
          headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
        })
      : null,
  ]);
  statuses.push(
    configured(
      "telegram",
      "Telegram",
      Boolean(env.TELEGRAM_BOT_TOKEN),
      Boolean(expectedBase) &&
        telegram?.ok &&
        telegram.result?.url === `${expectedBase}/bot-webhooks/telegram` &&
        !telegram.result?.pending_update_count,
      !env.TELEGRAM_BOT_TOKEN
        ? "Add Telegram credentials to .env"
        : !telegram?.ok
          ? "Could not verify Telegram; check network and credentials"
          : !expectedBase || telegram.result?.url !== `${expectedBase}/bot-webhooks/telegram`
            ? "Webhook differs from the active tunnel; rerun dev:full"
            : telegram.result?.pending_update_count
              ? "Updates awaiting delivery; check the public API"
              : "Webhook matches the tunnel; no pending updates",
    ),
    configured(
      "discord",
      "Discord",
      Boolean(env.DISCORD_BOT_TOKEN),
      Boolean(expectedBase) &&
        discord?.id === env.DISCORD_APPLICATION_ID &&
        discord?.interactions_endpoint_url === `${expectedBase}/bot-webhooks/discord`,
      !env.DISCORD_BOT_TOKEN
        ? "Add Discord credentials to .env"
        : !discord
          ? "Could not verify Discord; check network and credentials"
          : discord.id !== env.DISCORD_APPLICATION_ID
            ? "Application ID differs from the configured bot"
            : !expectedBase || discord.interactions_endpoint_url !== `${expectedBase}/bot-webhooks/discord`
              ? "Interaction endpoint differs from the tunnel; rerun dev:full"
              : "Application identity and interaction endpoint match",
    ),
    configured(
      "stripe",
      "Stripe sandbox",
      env.BILLING_MODE === "stripe_test",
      Boolean(publicUrl) &&
        stripe?.livemode === false &&
        stripe?.metadata?.application === "marketpilot" &&
        stripe?.status === "enabled" &&
        stripe?.url === `${publicUrl}/api/v1/billing/webhook` &&
        Boolean(env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")),
      env.BILLING_MODE === "stripe_test"
        ? !stripe
          ? "Could not verify the sandbox endpoint; check network and Stripe settings"
          : !env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")
            ? "Signing secret missing; run billing:setup-webhook"
            : stripe.livemode !== false || stripe.metadata?.application !== "marketpilot"
              ? "Endpoint is not a MarketPilot sandbox endpoint"
              : stripe.status !== "enabled" || stripe.url !== `${publicUrl}/api/v1/billing/webhook`
                ? "Sandbox endpoint differs from the tunnel; rerun dev:full"
                : "Sandbox endpoint matches; local signing secret configured"
        : "Stripe sandbox mode is not enabled",
    ),
  );
  const data = { checkedAt: new Date().toISOString(), services: statuses };
  mkdirSync(localDir, { recursive: true, mode: 0o700 });
  const temporary = `${statusPath}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
  renameSync(temporary, statusPath);
  return data;
}
export function printSnapshot(data) {
  for (const item of data.services)
    console.log(`[${item.status === "ready" ? "ready" : item.status}] ${item.label}: ${item.detail}`);
}
