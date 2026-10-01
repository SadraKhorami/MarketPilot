import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";

import { API_KEY_RATE_LIMIT, API_RATE_WINDOW_SECONDS } from "../api-keys/api-catalog";
import { RedisService } from "../redis.service";

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly fallback = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string; apiKeyId?: string } }>();
    if (request.method === "GET" && /^\/(?:api\/v1\/)?health(?:\/ready)?$/.test(request.path)) return true;
    if (request.method === "POST" && request.path.endsWith("/auth/logout")) return true;
    // Webhook acknowledgements have a three-second deadline. Use a cheap pre-auth IP guard;
    // verified platform senders get distributed, fail-closed limits in BotRateService.
    if (request.method === "POST" && /^\/(?:api\/v1\/)?bot-webhooks\/(telegram|discord)$/.test(request.path)) {
      const now = Date.now();
      const key = `webhook:${request.ip ?? "unknown"}`;
      if (this.fallback.size > 10000) {
        for (const [entry, bucket] of this.fallback) if (bucket.expiresAt <= now) this.fallback.delete(entry);
        if (this.fallback.size > 10000) throw rateLimited();
      }
      const bucket = this.fallback.get(key);
      if (!bucket || bucket.expiresAt <= now) this.fallback.set(key, { count: 1, expiresAt: now + 60000 });
      else if (++bucket.count > 600) throw rateLimited();
      return true;
    }
    const response = context.switchToHttp().getResponse<Response>();
    const identity = request.user?.apiKeyId ?? request.user?.id ?? request.ip ?? "unknown";
    const authAction = request.method === "POST" ? request.path.match(/\/auth\/(login|register)$/)?.[1] : undefined;
    const limit = authAction ? 10 : request.user?.apiKeyId ? API_KEY_RATE_LIMIT : request.user ? 300 : 120;
    const windowSeconds = API_RATE_WINDOW_SECONDS;
    const key = authAction
      ? `ratelimit:auth:${authAction}:${identity}`
      : `ratelimit:${request.user?.apiKeyId ? "key" : "session"}:${identity}`;

    let count: number;
    let resetSeconds: number;
    let mode: "redis" | "local" = "redis";
    try {
      await this.redis.ensureConnected();
      const transaction = this.redis.client.multi();
      transaction.incr(key);
      transaction.expire(key, windowSeconds, "NX");
      transaction.pttl(key);
      const result = await transaction.exec();
      if (!result || result.some(([error]) => error)) throw new Error("Rate-limit transaction failed");
      count = Number(result[0][1]);
      const ttlMs = Number(result[2][1]);
      if (!Number.isInteger(count) || count < 1 || !Number.isFinite(ttlMs) || ttlMs < 0)
        throw new Error("Invalid rate-limit bucket");
      resetSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    } catch {
      mode = "local";
      const now = Date.now();
      // Bound memory even when Redis is unavailable and many identities are used.
      if (this.fallback.size >= 10_000) {
        for (const [entry, bucket] of this.fallback) if (bucket.expiresAt <= now) this.fallback.delete(entry);
        if (!this.fallback.has(key) && this.fallback.size >= 10_000) {
          response.setHeader("Retry-After", windowSeconds);
          throw rateLimited(windowSeconds);
        }
      }
      let bucket = this.fallback.get(key);
      if (!bucket || bucket.expiresAt <= now) {
        bucket = { count: 0, expiresAt: now + windowSeconds * 1000 };
        this.fallback.set(key, bucket);
      }
      count = ++bucket.count;
      resetSeconds = Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
    }

    if (request.user?.apiKeyId) {
      response.setHeader("X-RateLimit-Limit", limit);
      response.setHeader("X-RateLimit-Window", windowSeconds);
      response.setHeader("X-RateLimit-Remaining", Math.max(0, limit - count));
      response.setHeader("X-RateLimit-Reset", Math.ceil(Date.now() / 1000) + resetSeconds);
      response.setHeader("X-RateLimit-Mode", mode);
    }
    if (count > limit) {
      response.setHeader("Retry-After", resetSeconds);
      throw rateLimited(resetSeconds);
    }
    return true;
  }
}

function rateLimited(retryAfterSeconds = API_RATE_WINDOW_SECONDS) {
  return new HttpException(
    {
      error: {
        code: "RATE_LIMITED",
        message: `Too many requests. Retry in ${retryAfterSeconds} seconds.`,
        retryAfterSeconds,
      },
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
