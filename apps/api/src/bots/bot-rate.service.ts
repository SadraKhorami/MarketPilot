import { createHash } from "node:crypto";
import { HttpException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { RedisService } from "../redis.service";
@Injectable()
export class BotRateService {
  constructor(private readonly redis: RedisService) {}
  async consume(scope: string, identity: string, limit: number, seconds = 60) {
    const key = `marketpilot:bot-rate:${scope}:${createHash("sha256").update(identity).digest("hex")}`;
    try {
      await this.redis.ensureConnected();
      const count = Number(
        await this.redis.client.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
          1,
          key,
          seconds,
        ),
      );
      if (count > limit) throw new HttpException("Too many requests. Try again later.", 429);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException("Bot request limits are temporarily unavailable.");
    }
  }
}
