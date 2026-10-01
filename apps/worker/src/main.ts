import { resolve } from "node:path";
import { PrismaClient } from "@marketpilot/db";
import dotenv from "dotenv";

dotenv.config({ path: resolve(__dirname, "../../../.env"), quiet: true });
const db = new PrismaClient();
async function main() {
  // Import after dotenv so the RSS module reads configured credentials/cadence.
  const { startAlertWorker } = await import("./alert-worker.js");
  const { startNewsWorker } = await import("./news.js");
  const closeAlerts = await startAlertWorker(db);
  let closeNews: (() => Promise<void>) | undefined;
  try {
    closeNews = await startNewsWorker();
  } catch (error) {
    await closeAlerts();
    throw error;
  }
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await Promise.allSettled([closeAlerts(), closeNews?.()]);
    await db.$disconnect();
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}
void main().catch(async () => {
  console.error(JSON.stringify({ event: "worker_start_failed" }));
  await db.$disconnect();
  process.exitCode = 1;
});
