import { createServer } from "node:http";
import type { PrismaClient } from "@marketpilot/db";
import {
  boundedOperation,
  heartbeatKey,
  type QueueRuntime,
  type WorkerSnapshot,
  workerRegistryKey,
  workerStatusPrefix,
} from "@marketpilot/jobs";
import type { Queue, Worker } from "bullmq";
import type Redis from "ioredis";

export class WorkerHealth {
  private readonly tracked: Array<{
    worker: Worker;
    queue: Pick<Queue, "isPaused">;
    transportReady: boolean;
    metrics: Omit<QueueRuntime, "ready">;
  }> = [];
  private probing: Promise<WorkerSnapshot> | undefined;
  private stopping = false;
  constructor(
    private readonly db: PrismaClient,
    private readonly redis: Redis,
    readonly instanceId: string,
  ) {}

  track(worker: Worker, queue: Pick<Queue, "isPaused">) {
    const metrics: Omit<QueueRuntime, "ready"> = {
      name: worker.name,
      lastCompletedAt: null,
      lastFailedAt: null,
      lastFailureCode: null,
      lastLatencyMs: null,
    };
    const tracked = { worker, queue, metrics, transportReady: true };
    this.tracked.push(tracked);
    worker.on("error", () => {
      tracked.transportReady = false;
    });
    worker.on("ready", () => {
      tracked.transportReady = true;
    });
    worker.on("completed", (job) => {
      metrics.lastCompletedAt = new Date().toISOString();
      metrics.lastLatencyMs = job.processedOn ? Math.max(0, Date.now() - job.processedOn) : null;
      console.log(
        JSON.stringify({
          event: "job_completed",
          timestamp: metrics.lastCompletedAt,
          workerId: this.instanceId,
          queue: worker.name,
          jobId: job.id,
          latencyMs: metrics.lastLatencyMs,
        }),
      );
    });
    worker.on("failed", (job, error) => {
      metrics.lastFailedAt = new Date().toISOString();
      metrics.lastFailureCode = /^[A-Z_]{3,80}$/.test(error.message) ? error.message : "JOB_FAILED";
      metrics.lastLatencyMs = job?.processedOn ? Math.max(0, Date.now() - job.processedOn) : null;
    });
  }

  async probe(): Promise<WorkerSnapshot> {
    if (this.probing) return this.probing;
    this.probing = this.check().finally(() => {
      this.probing = undefined;
    });
    return this.probing;
  }
  private async check(): Promise<WorkerSnapshot> {
    const [database, redis, queues] = await Promise.all([
      boundedOperation(this.db.$queryRaw`SELECT 1`).then(
        () => true,
        () => false,
      ),
      boundedOperation(this.redis.ping()).then(
        () => true,
        () => false,
      ),
      Promise.all(
        this.tracked.map(async (tracked) => {
          const { worker, queue, metrics } = tracked;
          const connected = await boundedOperation(worker.client).then(
            (client) => client.status === "ready",
            () => false,
          );
          if (!connected) return { ...metrics, ready: false };
          const paused = await boundedOperation(queue.isPaused()).catch(() => true);
          return {
            ...metrics,
            ready:
              !this.stopping &&
              worker.isRunning() &&
              !worker.isPaused() &&
              !paused &&
              connected &&
              tracked.transportReady,
          };
        }),
      ),
    ]);
    return {
      workerId: this.instanceId,
      checkedAt: new Date().toISOString(),
      database,
      redis,
      queues,
      ready: !this.stopping && database && redis && queues.length === 4 && queues.every((queue) => queue.ready),
    };
  }
  async publish() {
    const status = await this.probe();
    await boundedOperation(this.redis.set(`${workerStatusPrefix}${this.instanceId}`, JSON.stringify(status), "EX", 90));
    await this.redis.zadd(workerRegistryKey, Date.now(), this.instanceId);
    await this.redis.zremrangebyscore(workerRegistryKey, 0, Date.now() - 90000);
    if (status.ready) await this.redis.zadd(heartbeatKey, Date.now(), this.instanceId);
    else {
      await this.redis.zrem(heartbeatKey, this.instanceId);
      console.error(
        JSON.stringify({ event: "worker_not_ready", timestamp: status.checkedAt, workerId: this.instanceId }),
      );
    }
    await this.redis.zremrangebyscore(heartbeatKey, 0, Date.now() - 90000);
  }
  stop() {
    this.stopping = true;
  }
}

export async function startHealthServer(probe: () => Promise<WorkerSnapshot>) {
  const port = Number(process.env.WORKER_HEALTH_PORT ?? 4100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid configuration: WORKER_HEALTH_PORT");
  let stopping = false;
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    if (request.method !== "GET" || !["/health", "/health/ready"].includes(request.url ?? "")) {
      response.writeHead(404).end(JSON.stringify({ error: "NOT_FOUND" }));
      return;
    }
    const reply = (ready: boolean) =>
      response.writeHead(ready ? 200 : 503).end(
        JSON.stringify({
          data: { status: ready ? "ok" : "not_ready", timestamp: new Date().toISOString() },
        }),
      );
    if (request.url === "/health") {
      reply(!stopping);
      return;
    }
    void probe().then(
      (status) => reply(!stopping && status.ready),
      () => reply(false),
    );
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, process.env.WORKER_HEALTH_HOST ?? "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  return async () => {
    stopping = true;
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  };
}
