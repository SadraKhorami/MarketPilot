import { type BeforeApplicationShutdown, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2500,
      commandTimeout: 2500,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2000),
    });
    this.client.on("error", () => this.logger.warn({ event: "redis_unavailable" }));
  }

  async ensureConnected() {
    if (this.client.status === "wait") await this.client.connect();
    if (this.client.status !== "ready") throw new Error("Redis is not ready");
  }

  async beforeApplicationShutdown() {
    if (this.client.status !== "end") await this.client.quit().catch(() => undefined);
  }
}
