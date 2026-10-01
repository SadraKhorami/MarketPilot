import { type PrismaClient } from "@marketpilot/db";
import { connectionOptions, createQueue, queuePrefix } from "@marketpilot/jobs";
import { Worker } from "bullmq";
import type Redis from "ioredis";
import { deliverExternal } from "./external-delivery.js";
export async function startExternalWorker(db: PrismaClient, redis: Redis) {
  const queue = createQueue("external-notifications");
  queue.on("error", () => console.error(JSON.stringify({ event: "external_queue_unavailable" })));
  const dispatch = async () => {
    const items = await db.externalDelivery.findMany({
      where: {
        OR: [
          { status: { in: ["pending", "retry"] }, nextAttemptAt: { lte: new Date() } },
          { status: "sending", sendingAt: { lt: new Date(Date.now() - 60000) } },
        ],
      },
      orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
      take: 200,
      select: { id: true, adminRetries: true },
    });
    for (const item of items) {
      const jobId = `${item.id}-${item.adminRetries}`;
      const job = await queue.getJob(jobId);
      if (job) {
        const status = await job.getState();
        if (status === "failed") {
          await db.externalDelivery.updateMany({
            where: { id: item.id, OR: [{ status: "sending" }, { status: "retry", sendingAt: { not: null } }] },
            data: { status: "unknown", failureCode: "PROVIDER_ACCEPTANCE_UNKNOWN" },
          });
          await db.externalDelivery.updateMany({
            where: { id: item.id, status: { in: ["pending", "retry"] } },
            data: { status: "failed", failureCode: "JOB_ATTEMPTS_EXHAUSTED" },
          });
          continue;
        }
        if (status !== "completed") continue;
        await job.remove();
      }
      await queue.add("deliver", { id: item.id }, { jobId });
    }
  };
  const worker = new Worker<{ id?: string }>(
    "external-notifications",
    async (job) => {
      try {
        return await (job.name === "dispatch"
          ? dispatch()
          : job.data.id
            ? deliverExternal(db, redis, job.data.id)
            : Promise.reject(new Error("INVALID_EXTERNAL_JOB")));
      } catch {
        throw new Error("EXTERNAL_JOB_FAILED");
      }
    },
    {
      prefix: queuePrefix,
      connection: { ...connectionOptions(), maxRetriesPerRequest: null },
      concurrency: 2,
      limiter: { max: 1, duration: 1100 },
    },
  );
  worker.on("error", () => console.error(JSON.stringify({ event: "external_worker_unavailable" })));
  worker.on("failed", (job) =>
    console.error(JSON.stringify({ event: "external_delivery_failed", deliveryId: job?.data.id })),
  );
  const close = async () => {
    await worker.close();
    await queue.close();
  };
  try {
    await worker.waitUntilReady();
    await queue.upsertJobScheduler("external-outbox-v1", { every: 10000 }, { name: "dispatch", data: {} });
  } catch (error) {
    await close();
    throw error;
  }
  return { close, worker };
}
