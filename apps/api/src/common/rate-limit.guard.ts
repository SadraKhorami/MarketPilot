import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { RedisService } from "../redis.service";

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly fallback = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const identity = request.user?.id ?? request.ip ?? "unknown";
    const authAction = request.method === "POST" ? request.path.match(/\/auth\/(login|register)$/)?.[1] : undefined;
    const limit = authAction ? 10 : 120;
    const windowSeconds = 60;
    const key = authAction ? `ratelimit:auth:${authAction}:${identity}` : `ratelimit:api:${identity}`;

    try {
      await this.redis.ensureConnected();
      const transaction = this.redis.client.multi();
      transaction.incr(key);
      transaction.expire(key, windowSeconds, "NX");
      const result = await transaction.exec();
      const count = Number(result?.[0]?.[1] ?? 0);
      if (count > limit) throw rateLimited();
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) throw error;
      const now = Date.now();
      const bucket = this.fallback.get(key);
      if (!bucket || bucket.expiresAt <= now)
        this.fallback.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      else if (++bucket.count > limit) throw rateLimited();
    }

    if (this.fallback.size > 10_000) {
      const now = Date.now();
      for (const [fallbackKey, bucket] of this.fallback) if (bucket.expiresAt <= now) this.fallback.delete(fallbackKey);
    }
    return true;
  }
}

function rateLimited() {
  return new HttpException(
    { error: { code: "RATE_LIMITED", message: "Too many requests. Try again shortly." } },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
