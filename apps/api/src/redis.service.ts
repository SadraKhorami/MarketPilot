import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2000),
    });
    this.client.on("error", (error: Error) => this.logger.warn(`Redis connection issue: ${error.message}`));
  }

  async ensureConnected() {
    if (this.client.status === "wait") await this.client.connect();
    if (this.client.status !== "ready") throw new Error("Redis is not ready");
  }

  async onModuleDestroy() {
    if (this.client.status !== "end") await this.client.quit().catch(() => undefined);
  }
}
