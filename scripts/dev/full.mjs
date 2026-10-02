import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  environment,
  json,
  localDir,
  localEnvironment,
  portOpen,
  printSnapshot,
  ready,
  root,
  run as runCommand,
  saveEnvironment,
  snapshot,
  tunnel,
} from "./runtime.mjs";

const children = new Set();
const cancellation = new AbortController();
const run = (command, args, options = {}) => runCommand(command, args, { ...options, signal: cancellation.signal });
const integrations = [];
const lock = resolve(localDir, "dev-full.lock");
let ownsLock = false;
let stopping = false;
function start(command, args, env = environment()) {
  if (stopping) throw new Error("Local startup cancelled.");
  const child = spawn(command, args, { cwd: root, env, stdio: "inherit", detached: process.platform !== "win32" });
  children.add(child);
  child.once("error", () => console.error(`[attention] ${command} could not start.`));
  child.once("exit", () => children.delete(child));
  return child;
}
async function stop(child) {
  if (!children.has(child)) return;
  const exited = new Promise((done) => child.once("exit", done));
  try {
    if (process.platform === "win32") child.kill("SIGTERM");
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    return;
  }
  await Promise.race([exited, delay(10000)]);
  if (children.has(child)) {
    try {
      process.kill(process.platform === "win32" ? child.pid : -child.pid, "SIGKILL");
    } catch {
      /* Already stopped. */
    }
  }
}
async function shutdown() {
  if (stopping) return;
  stopping = true;
  cancellation.abort();
  console.log("\nStopping processes started by dev:full. Existing services and Docker data are preserved.");
  await Promise.all([...children].map(stop));
  if (ownsLock) {
    try {
      unlinkSync(lock);
    } catch {
      /* Lock already removed. */
    }
  }
}
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
async function waitFor(check, label, milliseconds = 120000) {
  const until = Date.now() + milliseconds;
  while (!stopping && Date.now() < until) {
    if (await check()) return;
    await delay(1500);
  }
  throw new Error(`${label} is not ready. Review its output before retrying.`);
}
async function integration(id, label, enabled, operation) {
  if (!enabled) {
    integrations.push({ id, label, status: "not_configured", detail: "No local credentials configured" });
    return;
  }
  try {
    await operation();
    integrations.push({ id, label, status: "ready", detail: "Webhook configuration synchronized" });
  } catch {
    integrations.push({
      id,
      label,
      status: "attention",
      detail: `Run ${id === "stripe" ? "pnpm billing:setup-webhook" : `pnpm bots:setup ${id}`} and review configuration`,
    });
  }
}
async function main() {
  const env = environment();
  localEnvironment(env);
  if (!existsSync(resolve(root, "node_modules"))) throw new Error("Run pnpm install --frozen-lockfile once first.");
  mkdirSync(localDir, { recursive: true, mode: 0o700 });
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    let active = false;
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
        active = true;
      } catch {
        /* Stale lock. */
      }
    }
    if (active) throw new Error("dev:full is already running. Use its terminal or pnpm dev:status.");
    unlinkSync(lock);
  }
  writeFileSync(lock, String(process.pid), { flag: "wx", mode: 0o600 });
  ownsLock = true;
  console.log("Starting the local MarketPilot workspace…");
  try {
    await run("docker", ["info"], { quiet: true, timeout: 10000 });
  } catch {
    const context = await run("docker", ["context", "show"], { quiet: true });
    if (!context.startsWith("colima")) throw new Error("Open Docker Desktop, then retry dev:full.");
    console.log("Starting Colima…");
    await run("colima", ["start"], { timeout: 180000 });
  }
  await run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "90", "postgres", "redis"]);
  // Prisma's generated client lives outside Turbo's cached package outputs.
  await run("pnpm", ["--filter", "@marketpilot/db", "generate"]);
  // Build runtime dependencies, not applications or tests.
  await run("pnpm", ["exec", "turbo", "run", "build", "--filter=./packages/*"], { timeout: 180000 });
  let api;
  if (await portOpen(4000)) {
    if (!(await ready("http://127.0.0.1:4000/api/v1/health/ready")))
      throw new Error(
        "Port 4000 is occupied but the MarketPilot API is not ready. Stop the existing dev process and retry.",
      );
    console.log("Reusing the running API. Pending migrations require stopping it and rerunning dev:full.");
  } else {
    await run("pnpm", ["db:deploy"]);
    api = start("pnpm", ["--filter", "@marketpilot/api", "dev"]);
    await waitFor(() => ready("http://127.0.0.1:4000/api/v1/health/ready"), "API");
  }
  const wantsTunnel = Boolean(env.TELEGRAM_BOT_TOKEN || env.DISCORD_BOT_TOKEN || env.BILLING_MODE === "stripe_test");
  let publicUrl = await tunnel();
  if (!publicUrl && wantsTunnel) {
    if (await portOpen(4040))
      throw new Error(
        "The ngrok inspector is active but has no HTTPS tunnel to port 4000. Correct its target and retry.",
      );
    start("ngrok", ["http", "4000"]);
    await waitFor(
      async () => {
        publicUrl = await tunnel();
        return Boolean(publicUrl);
      },
      "ngrok (check installation and authtoken)",
      30000,
    );
  }
  if (publicUrl) {
    await waitFor(() => ready(`${publicUrl}/api/v1/health/ready`), "Public API", 30000);
    saveEnvironment({ BOT_API_URL: `${publicUrl}/api/v1`, BILLING_WEBHOOK_API_URL: publicUrl });
    await integration("telegram", "Telegram", Boolean(env.TELEGRAM_BOT_TOKEN), () =>
      run("pnpm", ["bots:setup", "telegram"]),
    );
    await integration("discord", "Discord", Boolean(env.DISCORD_BOT_TOKEN), async () => {
      const config = environment();
      const headers = { Authorization: `Bot ${config.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" };
      const app = await json("https://discord.com/api/v10/applications/@me", { headers });
      if (!app || app.id !== config.DISCORD_APPLICATION_ID) throw new Error("Discord identity mismatch.");
      const endpoint = `${publicUrl}/api/v1/bot-webhooks/discord`;
      if (
        app.interactions_endpoint_url !== endpoint &&
        !(await json("https://discord.com/api/v10/applications/@me", {
          method: "PATCH",
          headers,
          body: JSON.stringify({ interactions_endpoint_url: endpoint }),
        }))
      )
        throw new Error("Discord endpoint update failed. Set Interactions Endpoint URL in the Developer Portal.");
      await run("pnpm", ["bots:setup", "discord"]);
    });
    const before = environment().STRIPE_WEBHOOK_SECRET;
    await integration("stripe", "Stripe sandbox", env.BILLING_MODE === "stripe_test", () =>
      run("pnpm", ["billing:setup-webhook"]),
    );
    if (before !== environment().STRIPE_WEBHOOK_SECRET) {
      if (api) {
        await stop(api);
        api = start("pnpm", ["--filter", "@marketpilot/api", "dev"]);
        await waitFor(
          () => ready("http://127.0.0.1:4000/api/v1/health/ready"),
          "API after loading the Stripe signing secret",
        );
      } else {
        console.log("[attention] Restart your existing API terminal to load the new Stripe signing secret.");
      }
    }
  }
  printSnapshot({ services: integrations });
  const workerPort = Number(env.WORKER_HEALTH_PORT ?? 4100);
  if (!(await portOpen(workerPort))) start("pnpm", ["--filter", "@marketpilot/worker", "dev"]);
  await waitFor(() => ready(`http://127.0.0.1:${workerPort}/health/ready`), "Worker");
  if (!(await portOpen(3000))) start("pnpm", ["--filter", "@marketpilot/web", "dev"]);
  await waitFor(async () => {
    try {
      return (await fetch("http://127.0.0.1:3000", { signal: AbortSignal.timeout(5000) })).ok;
    } catch {
      return false;
    }
  }, "Dashboard");
  console.log(
    "\nDashboard: http://localhost:3000\nService status: http://localhost:3000/dashboard/dev-docs/daily\nKeep this terminal open. Ctrl+C stops only processes started here.\n",
  );
  let previous = "";
  while (!stopping) {
    const data = await snapshot();
    const state = JSON.stringify(data.services);
    if (state !== previous) {
      printSnapshot(data);
      previous = state;
    }
    await delay(15000);
  }
}
main()
  .catch((error) => {
    console.error(`[attention] ${error instanceof Error ? error.message : "Local startup failed."}`);
    process.exitCode = 1;
  })
  .finally(shutdown);
