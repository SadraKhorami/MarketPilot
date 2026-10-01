import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@marketpilot/db";
import { connectionOptions, createQueue, heartbeatKey, jobConfig, queuePrefix } from "@marketpilot/jobs";
import { CoinbaseExchangeProvider, MarketDataProviderError } from "@marketpilot/market-data";
import { MultiMarketProvider, TradingViewProvider } from "@marketpilot/market-data/providers";
import { type Job, type Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { deliverTrigger } from "./alert-delivery.js";
import { evaluateObservation } from "./alert-evaluator.js";
import { isInterval } from "./alert-observation.js";

type RefreshJob = { symbol?: string; interval?: string };
type ReferenceJob = { id: string };
export async function startAlertWorker(db: PrismaClient) {
  const config = jobConfig();
  const instanceId = randomUUID();
  const redis = new Redis({
    ...connectionOptions(),
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on("error", () =>
    console.error(
      JSON.stringify({
        event: "alert_redis_unavailable",
        workerId: instanceId,
      }),
    ),
  );
  const queues = {
    refresh: createQueue("market-refresh"),
    evaluation: createQueue("alert-evaluation"),
    notifications: createQueue("notifications"),
  };
  const provider = new MultiMarketProvider(new CoinbaseExchangeProvider(), new TradingViewProvider());
  const connection = { ...connectionOptions(), maxRetriesPerRequest: null };
  async function publish(queue: Queue, id: string) {
    const existing = await queue.getJob(id);
    let failureCode: string | null = null;
    if (existing) {
      const state = await existing.getState();
      if (state === "completed") {
        // A completed DB stage does not appear in the pending outbox query.
        await existing.remove();
      } else {
        if (state === "failed") failureCode = "JOB_ATTEMPTS_EXHAUSTED";
        await markPublished(queue.name, id, failureCode);
        return; // Exhausted failures await the admin's explicit retry.
      }
    }
    await queue.add("deliver", { id }, { jobId: id });
    await markPublished(queue.name, id, null);
  }
  async function markPublished(queue: string, id: string, failureCode: string | null) {
    const data = { lastPublishedAt: new Date(), failureCode };
    if (queue === "alert-evaluation") await db.alertObservation.updateMany({ where: { id }, data });
    else await db.alertTrigger.updateMany({ where: { id }, data });
  }
  async function dispatch() {
    const groups = await db.alert.findMany({
      where: { enabled: true, user: { status: "ACTIVE" } },
      distinct: ["assetId", "interval"],
      select: { assetId: true, interval: true },
    });
    for (const group of groups) {
      const key = createHash("sha256").update(`${group.assetId}-${group.interval}`).digest("hex");
      await queues.refresh.add(
        "observe",
        { symbol: group.assetId, interval: group.interval },
        {
          deduplication: { id: key },
          jobId: `${key}-${Math.floor(Date.now() / config.cadenceMs)}`,
        },
      );
    }
    const [observations, triggers] = await Promise.all([
      db.alertObservation.findMany({
        where: { completedAt: null },
        orderBy: [{ lastPublishedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
        take: 200,
        select: { id: true },
      }),
      db.alertTrigger.findMany({
        where: { deliveryStatus: "pending" },
        orderBy: [{ lastPublishedAt: { sort: "asc", nulls: "first" } }, { triggeredAt: "asc" }],
        take: 200,
        select: { id: true },
      }),
    ]);
    for (const item of observations) await publish(queues.evaluation, item.id);
    for (const item of triggers) await publish(queues.notifications, item.id);
    await db.alertObservation.deleteMany({
      where: { completedAt: { lt: new Date(Date.now() - 7 * 86400000) } },
    });
  }
  const refresh = new Worker<RefreshJob>(
    "market-refresh",
    async (job) => {
      if (job.name === "dispatch") return dispatch();
      const { symbol, interval } = job.data;
      if (!symbol || !interval || !isInterval(interval)) throw new Error("INVALID_MARKET_JOB");
      if (
        !(await db.alert.count({
          where: {
            assetId: symbol,
            interval,
            enabled: true,
            user: { status: "ACTIVE" },
          },
        }))
      )
        return;
      try {
        const data = await provider.getMarketData(symbol, interval);
        const fetchedAt = new Date();
        const observation = await db.alertObservation.create({
          data: {
            symbol,
            interval,
            payload: data as Prisma.InputJsonValue,
            fetchedAt,
          },
        });
        // Shared API cache is an optimization; the durable outbox remains the authority.
        await redis
          .set(
            `marketpilot:market-data:v1:${data.source}:${encodeURIComponent(symbol)}:${interval}`,
            JSON.stringify({
              source: data.source,
              requestedSymbol: symbol,
              data,
              fetchedAt: fetchedAt.toISOString(),
              freshness: "fresh",
            }),
            "EX",
            900,
          )
          .catch(() => undefined);
        await publish(queues.evaluation, observation.id).catch(() =>
          console.error(
            JSON.stringify({
              event: "evaluation_publication_deferred",
              observationId: observation.id,
            }),
          ),
        );
      } catch (error) {
        const reason = error instanceof MarketDataProviderError ? error.code : "REFRESH_FAILED";
        await db.alert.updateMany({
          where: { assetId: symbol, interval, enabled: true },
          data: { lastEvaluatedAt: new Date(), evaluationReason: reason },
        });
        throw new Error(reason);
      }
    },
    {
      prefix: queuePrefix,
      connection,
      concurrency: config.refreshConcurrency,
      limiter: { max: config.providerJobsPerMinute, duration: 60000 },
    },
  );
  const evaluation = new Worker<ReferenceJob>("alert-evaluation", (job) => evaluateObservation(db, job.data.id), {
    prefix: queuePrefix,
    connection,
    concurrency: config.evaluationConcurrency,
  });
  const notifications = new Worker<ReferenceJob>("notifications", (job) => deliverTrigger(db, job.data.id), {
    prefix: queuePrefix,
    connection,
    concurrency: config.notificationConcurrency,
  });
  const workers = [refresh, evaluation, notifications];
  for (const worker of workers) {
    worker.on("failed", (job: Job | undefined, error: Error) => {
      const code = /^[A-Z_]{3,80}$/.test(error.message) ? error.message : "JOB_FAILED";
      console.error(
        JSON.stringify({
          event: "job_failed",
          workerId: instanceId,
          queue: worker.name,
          jobId: job?.id,
          attempts: job?.attemptsMade,
          code,
        }),
      );
    });
    worker.on("error", () =>
      console.error(
        JSON.stringify({
          event: "queue_worker_error",
          workerId: instanceId,
          queue: worker.name,
        }),
      ),
    );
  }
  for (const queue of Object.values(queues))
    queue.on("error", () => console.error(JSON.stringify({ event: "queue_unavailable", queue: queue.name })));
  const beat = async () => {
    if (workers.every((worker) => worker.isRunning() && !worker.isPaused()))
      await redis.zadd(heartbeatKey, Date.now(), instanceId);
    else await redis.zrem(heartbeatKey, instanceId);
    await redis.zremrangebyscore(heartbeatKey, 0, Date.now() - 90000);
  };
  const timer = setInterval(() => void beat().catch(() => undefined), 15000);
  const close = async () => {
    clearInterval(timer);
    await Promise.all(workers.map((worker) => worker.close()));
    await redis.zrem(heartbeatKey, instanceId).catch(() => undefined);
    await Promise.all(Object.values(queues).map((queue) => queue.close()));
    await redis.quit().catch(() => undefined);
  };
  try {
    await Promise.all(workers.map((worker) => worker.waitUntilReady()));
    await queues.refresh.setGlobalConcurrency(config.refreshConcurrency);
    await queues.refresh.upsertJobScheduler(
      "active-alert-markets-v1",
      { every: config.cadenceMs },
      { name: "dispatch", data: {} },
    );
    await beat();
    console.log(
      JSON.stringify({
        event: "alert_worker_ready",
        workerId: instanceId,
        queues: workers.map((worker) => worker.name),
        cadenceSeconds: config.cadenceMs / 1000,
      }),
    );
  } catch (error) {
    await close();
    throw error;
  }
  return close;
}
