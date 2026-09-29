import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardResponses } from "./common/api-documentation";
import { Public } from "./common/auth";
import { DatabaseService } from "./database.module";
import { RedisService } from "./redis.service";

@ApiTags("Health")
@ApiStandardResponses()
@Controller("health")
@Public()
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Liveness check" })
  live() {
    return { data: { status: "ok", timestamp: new Date().toISOString() } };
  }

  @Get("ready")
  @ApiOperation({ summary: "Dependency readiness check" })
  async ready() {
    try {
      await this.db.$queryRaw`SELECT 1`;
      await this.redis.ensureConnected();
      return { data: { status: "ready", timestamp: new Date().toISOString() } };
    } catch {
      throw new ServiceUnavailableException({
        error: { code: "NOT_READY", message: "A required service is unavailable." },
      });
    }
  }
}
