import { resolve } from "node:path";
import { botConfiguration, botProviders } from "@marketpilot/bots";
import { PrismaClient } from "@marketpilot/db";
import { validateRuntimeEnvironment } from "@marketpilot/jobs";
import dotenv from "dotenv";
import { startHealthServer } from "./health.js";

dotenv.config({ path: resolve(__dirname, "../../../.env"), quiet: true });
const db = new PrismaClient();
async function main() {
  validateRuntimeEnvironment();
  if (process.env.NODE_ENV === "production") {
    for (const provider of botProviders) {
      const enabled = provider === "TELEGRAM" ? process.env.TELEGRAM_BOT_TOKEN : process.env.DISCORD_BOT_TOKEN;
      if (enabled && !botConfiguration(provider).configured) throw new Error("Invalid configuration: BOTS");
    }
  }
  // Import after dotenv so the RSS module reads configured cadence.
  const { startAlertWorker } = await import("./alert-worker.js");
  const { startNewsWorker } = await import("./news.js");
  const alerts = await startAlertWorker(db);
  let closeNews: (() => Promise<void>) | undefined;
  let closeHealth: (() => Promise<void>) | undefined;
  try {
    closeNews = await startNewsWorker(db);
    closeHealth = await startHealthServer(alerts.probe);
  } catch (error) {
    await Promise.allSettled([alerts.close(), closeNews?.()]);
    throw error;
  }
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    alerts.stop();
    console.log(JSON.stringify({ event: "worker_stopping", timestamp: new Date().toISOString() }));
    const deadline = setTimeout(() => {
      console.error(JSON.stringify({ event: "worker_shutdown_timeout", timestamp: new Date().toISOString() }));
      process.exit(1);
    }, 55000);
    const results = await Promise.allSettled([alerts.close(), closeNews?.(), closeHealth?.()]);
    const disconnect = await Promise.allSettled([db.$disconnect()]);
    clearTimeout(deadline);
    if ([...results, ...disconnect].some((result) => result.status === "rejected")) {
      console.error(JSON.stringify({ event: "worker_shutdown_failed", timestamp: new Date().toISOString() }));
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}
void main().catch(async (error: unknown) => {
  const configuration =
    error instanceof Error && /^(Invalid|Missing) configuration: [A-Z_, ]+$/.test(error.message)
      ? error.message
      : undefined;
  console.error(JSON.stringify({ event: "worker_start_failed", timestamp: new Date().toISOString(), configuration }));
  await db.$disconnect().catch(() => undefined);
  process.exit(1);
});
