import { boundedOperation } from "@marketpilot/jobs";
import { Controller, Get, Header, type OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiStandardResponses } from "./common/api-documentation";
import { Public } from "./common/auth";
import { DatabaseService } from "./database.module";
import { RedisService } from "./redis.service";

@ApiTags("Health")
@ApiStandardResponses()
@Controller("health")
@Public()
export class HealthController implements OnModuleDestroy {
  private stopping = false;
  onModuleDestroy() {
    this.stopping = true;
  }
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Liveness check" })
  live() {
    return { data: { status: "ok", timestamp: new Date().toISOString() } };
  }

  @Get("ready")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Dependency readiness check" })
  async ready() {
    try {
      if (this.stopping) throw new Error("SHUTTING_DOWN");
      await Promise.all([
        boundedOperation(this.db.$queryRaw`SELECT 1`),
        boundedOperation(this.redis.ensureConnected().then(() => this.redis.client.ping())),
      ]);
      return { data: { status: "ready", timestamp: new Date().toISOString() } };
    } catch {
      throw new ServiceUnavailableException({
        error: { code: "NOT_READY", message: "A required service is unavailable." },
      });
    }
  }
}
