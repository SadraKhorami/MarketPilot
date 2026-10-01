import { randomUUID } from "node:crypto";
import { type BotProvider, botConfiguration, botProviders, encryptPayload } from "@marketpilot/bots";
import { botHeartbeatKey, boundedOperation, connectionOptions, createQueue, queuePrefix } from "@marketpilot/jobs";
import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { DatabaseService } from "../database.module";
import { RedisService } from "../redis.service";
import { type CommandPayload } from "./bot-command.schema";
import { BotCommandProcessorService } from "./bot-command-processor.service";
import { BotRateService } from "./bot-rate.service";

@Injectable()
export class BotRuntimeService implements OnModuleInit, OnModuleDestroy {
  private queue: ReturnType<typeof createQueue> | undefined;
  private worker: Worker<{ id: string }> | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private recovering = false;
  private lastCleanupAt = 0;
  private transportReady = true;
  private readonly instance = randomUUID();
  private readonly abort = new AbortController();
  constructor(
    private readonly db: DatabaseService,
    private readonly processor: BotCommandProcessorService,
    private readonly redis: RedisService,
    private readonly rate: BotRateService,
  ) {}
  async accept(provider: BotProvider, eventId: string, payload: CommandPayload) {
    await this.rate.consume("commands", `${provider}:${payload.identity}`, 20);
    await this.db.botCommand.upsert({
      where: { provider_eventId: { provider, eventId } },
      update: {},
      create: { provider, eventId, payload: encryptPayload(payload), expiresAt: new Date(Date.now() + 10 * 60000) },
    });
    await this.db.botRuntime.upsert({
      where: { provider },
      create: { provider, inboundAt: new Date() },
      update: { inboundAt: new Date() },
    });
  }
  async onModuleInit() {
    this.timer = setInterval(
      () => void this.recover().catch(() => console.error(JSON.stringify({ event: "bot_recovery_deferred" }))),
      5000,
    );
    if (!botProviders.some((provider) => botConfiguration(provider).configured)) return;
    this.queue = createQueue("bot-commands");
    this.queue.on("error", () => console.error(JSON.stringify({ event: "bot_queue_unavailable" })));
    this.worker = new Worker<{ id: string }>(
      "bot-commands",
      (job) =>
        this.processor.process(job.data.id, this.abort.signal).catch((error: unknown) => {
          throw new Error(
            error instanceof Error && /^[A-Z_]{3,80}$/.test(error.message) ? error.message : "BOT_COMMAND_FAILED",
          );
        }),
      {
        prefix: queuePrefix,
        connection: { ...connectionOptions(), maxRetriesPerRequest: null },
        concurrency: 2,
        limiter: { max: 20, duration: 60000 },
      },
    );
    this.worker.on("error", () => {
      this.transportReady = false;
      console.error(JSON.stringify({ event: "bot_worker_unavailable" }));
    });
    this.worker.on("ready", () => {
      this.transportReady = true;
    });
    this.worker.on("completed", (job) =>
      console.log(
        JSON.stringify({
          event: "bot_job_completed",
          jobId: job.id,
          timestamp: new Date().toISOString(),
          latencyMs: job.processedOn ? Date.now() - job.processedOn : null,
        }),
      ),
    );
    this.worker.on("failed", (job) =>
      console.error(JSON.stringify({ event: "bot_command_failed", commandId: job?.data.id })),
    );
    // Redis outages must not stop the interactive API; heartbeats reflect actual readiness.
    void this.recover().catch(() => console.error(JSON.stringify({ event: "bot_recovery_deferred" })));
  }
  private async recover() {
    if (this.recovering || this.abort.signal.aborted) return;
    this.recovering = true;
    try {
      if (this.lastCleanupAt < Date.now() - 60000) {
        const [commands, links] = await Promise.all([
          this.db.botCommand.findMany({
            where: { expiresAt: { lt: new Date() } },
            orderBy: { expiresAt: "asc" },
            take: 500,
            select: { id: true },
          }),
          this.db.botLinkToken.findMany({
            where: { expiresAt: { lt: new Date(Date.now() - 86400000) } },
            orderBy: { expiresAt: "asc" },
            take: 500,
            select: { id: true },
          }),
        ]);
        if (commands.length)
          await this.db.botCommand.deleteMany({ where: { id: { in: commands.map((item) => item.id) } } });
        if (links.length)
          await this.db.botLinkToken.deleteMany({ where: { id: { in: links.map((item) => item.id) } } });
        this.lastCleanupAt = Date.now();
      }
      if (!this.queue) return;
      await this.redis.ensureConnected();
      const connected = this.worker
        ? await boundedOperation(this.worker.client).then(
            (client) => client.status === "ready",
            () => false,
          )
        : false;
      const paused = await boundedOperation(this.queue.isPaused());
      if (connected && !paused && this.transportReady && this.worker?.isRunning() && !this.worker.isPaused())
        await this.redis.client.zadd(botHeartbeatKey, Date.now(), this.instance);
      else await this.redis.client.zrem(botHeartbeatKey, this.instance);
      await this.redis.client.zremrangebyscore(botHeartbeatKey, 0, Date.now() - 90000);
      const pending = await this.db.botCommand.findMany({
        where: {
          status: { in: ["pending", "processing", "ready", "sending"] },
          expiresAt: { gt: new Date() },
          nextAttemptAt: { lte: new Date() },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
          createdAt: { lt: new Date(Date.now() - 1000) },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { id: true },
      });
      for (const item of pending) {
        const job = await this.queue.getJob(item.id);
        if (job) {
          const state = await job.getState();
          if (state === "failed") {
            await this.db.botCommand.updateMany({
              where: { id: item.id },
              data: { failureCode: "JOB_ATTEMPTS_EXHAUSTED" },
            });
            continue;
          }
          if (state !== "completed") continue;
          await job.remove();
        }
        await this.queue.add("command", { id: item.id }, { jobId: item.id });
      }
    } finally {
      this.recovering = false;
    }
  }
  async onModuleDestroy() {
    this.abort.abort();
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
    await this.redis.client.zrem(botHeartbeatKey, this.instance).catch(() => undefined);
  }
}
