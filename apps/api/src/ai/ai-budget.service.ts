import { randomUUID } from "node:crypto";
import { AIError } from "@marketpilot/ai";
import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis.service";
import { EntitlementsService } from "../billing/entitlements.service";

@Injectable()
export class AiBudgetService {
  constructor(
    private readonly redis: RedisService,
    private readonly entitlements: EntitlementsService,
  ) {}
  async acquire(userId: string, reservationUsd: number) {
    if (!Number.isFinite(reservationUsd) || reservationUsd < 0 || reservationUsd > 0.25)
      throw new AIError("AI_MODEL_BUDGET", "The research request exceeds its provider budget.");
    await this.redis.ensureConnected().catch(() => {
      throw new AIError("AI_LIMITS_UNAVAILABLE", "Research limits are temporarily unavailable.");
    });
    const token = randomUUID();
    const unlimitedResearch = await this.entitlements.hasAdminRole(userId);
    const reservedMicros = unlimitedResearch ? 0 : Math.ceil(reservationUsd * 1_000_000);
    const slot = `marketpilot:ai:active:${userId}`;
    const day = new Date().toISOString().slice(0, 10);
    const code = Number(
      await this.redis.client.eval(
        `
      if redis.call('EXISTS', KEYS[1]) == 1 then return 1 end
      redis.call('ZREMRANGEBYSCORE', KEYS[5], '-inf', ARGV[3])
      if redis.call('ZCARD', KEYS[5]) >= 4 then return 4 end
      local rate = tonumber(redis.call('GET', KEYS[2]) or '0')
      if rate >= 6 then return 2 end
      local spend = tonumber(redis.call('GET', KEYS[3]) or '0')
      local globalSpend = tonumber(redis.call('GET', KEYS[4]) or '0')
      if ARGV[4] ~= '1' and (spend + tonumber(ARGV[2]) > 1000000 or globalSpend + tonumber(ARGV[2]) > 10000000) then return 3 end
      redis.call('SET', KEYS[1], ARGV[1], 'EX', 120)
      redis.call('ZADD', KEYS[5], tonumber(ARGV[3]) + 120000, ARGV[1]); redis.call('EXPIRE', KEYS[5], 180)
      redis.call('INCR', KEYS[2]); redis.call('EXPIRE', KEYS[2], 60, 'NX')
      if ARGV[4] ~= '1' then
        redis.call('INCRBY', KEYS[3], ARGV[2]); redis.call('EXPIRE', KEYS[3], 172800, 'NX')
        redis.call('INCRBY', KEYS[4], ARGV[2]); redis.call('EXPIRE', KEYS[4], 172800, 'NX')
      end
      return 0`,
        5,
        slot,
        `marketpilot:ai:rate:${userId}`,
        `marketpilot:ai:budget:${day}:${userId}`,
        `marketpilot:ai:budget:${day}:global`,
        "marketpilot:ai:active:global",
        token,
        reservedMicros,
        Date.now(),
        unlimitedResearch ? "1" : "0",
      ),
    );
    if (code)
      throw new AIError(
        code === 1 || code === 4 ? "AI_BUSY" : code === 2 ? "AI_RATE_LIMITED" : "AI_DAILY_BUDGET",
        code === 1 || code === 4
          ? "Research concurrency is at capacity. Try again shortly."
          : code === 2
            ? "Too many research requests. Try again shortly."
            : "The daily research budget has been reached.",
      );
    return async (unusedReservation = false) => {
      await this.redis.client
        .eval(
          `if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('DEL', KEYS[1]) end
          local released = redis.call('ZREM', KEYS[2], ARGV[1])
          if ARGV[2] == '1' and released == 1 then
            for i = 3, 4 do
              local value = tonumber(redis.call('GET', KEYS[i]) or '0')
              if value > 0 then redis.call('DECRBY', KEYS[i], math.min(value, tonumber(ARGV[3]))) end
            end
          end
          return released`,
          4,
          slot,
          "marketpilot:ai:active:global",
          `marketpilot:ai:budget:${day}:${userId}`,
          `marketpilot:ai:budget:${day}:global`,
          token,
          unusedReservation ? "1" : "0",
          reservedMicros,
        )
        .catch(() => undefined);
    };
  }
}
