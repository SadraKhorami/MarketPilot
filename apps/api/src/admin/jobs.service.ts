import { createQueue, heartbeatKey, type QueueName, queueNames } from "@marketpilot/jobs";
import { BadRequestException, Injectable, type OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { type PageQueryDto, pageResult } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
import { RedisService } from "../redis.service";

@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly queues = new Map<QueueName, ReturnType<typeof createQueue>>();
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}
  private async bounded<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("QUEUE_TIMEOUT")), 5000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  private queue(name: string) {
    const known = queueNames.find((value) => value === name);
    if (!known) throw new BadRequestException("Unknown queue.");
    let queue = this.queues.get(known);
    if (!queue) {
      queue = createQueue(known);
      queue.on("error", () => undefined);
      this.queues.set(known, queue);
    }
    return queue;
  }
  async overview() {
    const [pendingEvaluations, pendingNotifications] = await Promise.all([
      this.db.alertObservation.count({ where: { completedAt: null } }),
      this.db.alertTrigger.count({ where: { deliveryStatus: "pending" } }),
    ]);
    try {
      await this.redis.ensureConnected();
      const activeWorkers = await this.redis.client.zcount(heartbeatKey, Date.now() - 45000, "+inf");
      const queues = await this.bounded(
        Promise.all(
          queueNames.map(async (name) => ({
            name,
            counts: await this.queue(name).getJobCounts("waiting", "active", "delayed", "failed", "completed"),
            paused: await this.queue(name).isPaused(),
          })),
        ),
      );
      return {
        checkedAt: new Date().toISOString(),
        redis: "reachable",
        activeWorkers,
        pendingEvaluations,
        pendingNotifications,
        queues,
      };
    } catch {
      return {
        checkedAt: new Date().toISOString(),
        redis: "unavailable",
        activeWorkers: null,
        pendingEvaluations,
        pendingNotifications,
        queues: null,
      };
    }
  }
  async list(name: string, status: "failed" | "waiting" | "active" | "delayed", query: PageQueryDto) {
    const queue = this.queue(name);
    try {
      const [jobs, counts] = await this.bounded(
        Promise.all([
          queue.getJobs([status], (query.page - 1) * query.pageSize, query.page * query.pageSize - 1, false),
          queue.getJobCounts(status),
        ]),
      );
      const items = jobs.map((job) => ({
        id: job.id,
        name: job.name,
        attempts: job.attemptsMade,
        createdAt: new Date(job.timestamp).toISOString(),
        failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        // Never return payloads, stack traces, URLs or database/provider exception text.
        reason: job.failedReason ? (/^[A-Z_]{3,80}$/.test(job.failedReason) ? job.failedReason : "JOB_FAILED") : null,
      }));
      return pageResult(items, counts[status] ?? 0, query);
    } catch {
      throw new ServiceUnavailableException({
        error: { code: "QUEUE_UNAVAILABLE", message: "Queue inspection is temporarily unavailable." },
      });
    }
  }
  async retry(name: string, id: string) {
    if (!/^[a-zA-Z0-9:_-]{1,180}$/.test(id)) throw new BadRequestException("Invalid job identifier.");
    const queue = this.queue(name);
    try {
      const job = await this.bounded(queue.getJob(id));
      if (!job) throw new BadRequestException("This job is no longer retained.");
      if ((await this.bounded(job.getState())) !== "failed") return { success: true, retried: false };
      try {
        await this.bounded(job.retry("failed", { resetAttemptsMade: true }));
      } catch {
        if ((await this.bounded(job.getState())) === "failed")
          throw new ServiceUnavailableException({
            error: { code: "QUEUE_UNAVAILABLE", message: "Could not retry this job." },
          });
      }
      return { success: true, retried: true };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({
        error: { code: "QUEUE_UNAVAILABLE", message: "Queue recovery is temporarily unavailable." },
      });
    }
  }
  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }
}
