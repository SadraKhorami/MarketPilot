import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ActivityController } from "./activity/activity.controller";
import { AdminModule } from "./admin/admin.module";
import { AiModule } from "./ai/ai.module";
import { AlertsController } from "./alerts/alerts.controller";
import { AlertsService } from "./alerts/alerts.service";
import { ApiKeysController } from "./api-keys/api-keys.controller";
import { ApiKeysService } from "./api-keys/api-keys.service";
import { ApiUsageService } from "./api-keys/api-usage.service";
import { AuthController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { AuthService } from "./auth/auth.service";
import { ActivityService } from "./common/activity.service";
import { ApiScopesGuard } from "./common/api-scopes.guard";
import { OriginGuard } from "./common/origin.guard";
import { RateLimitGuard } from "./common/rate-limit.guard";
import { RequestUsageMiddleware } from "./common/request-usage.middleware";
import { RolesGuard } from "./common/roles.guard";
import { DatabaseModule } from "./database.module";
import { HealthController } from "./health.controller";
import { MarketDataModule } from "./market-data/market-data.module";
import { NewsController } from "./news/news.controller";
import { NewsService } from "./news/news.service";
import { NotificationsModule } from "./notifications/notifications.module";
import { RedisModule } from "./redis.module";
import { SettingsController } from "./settings/settings.controller";
import { UsersController } from "./users/users.controller";
import { WatchlistsController } from "./watchlists/watchlists.controller";
import { WatchlistsService } from "./watchlists/watchlists.service";

@Module({
  imports: [DatabaseModule, RedisModule, MarketDataModule, AdminModule, NotificationsModule, AiModule],
  controllers: [
    AuthController,
    UsersController,
    WatchlistsController,
    AlertsController,
    ApiKeysController,
    ActivityController,
    SettingsController,
    HealthController,
    NewsController,
  ],
  providers: [
    AuthService,
    NewsService,
    ActivityService,
    WatchlistsService,
    AlertsService,
    ApiKeysService,
    ApiUsageService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: ApiScopesGuard },
    RequestUsageMiddleware,
  ],
})
export class AppModule {}
