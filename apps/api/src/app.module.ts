import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";

import { ActivityController } from "./activity/activity.controller";
import { AlertsController } from "./alerts/alerts.controller";
import { AlertsService } from "./alerts/alerts.service";
import { ApiKeysController } from "./api-keys/api-keys.controller";
import { ApiKeysService } from "./api-keys/api-keys.service";
import { AuthController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { AuthService } from "./auth/auth.service";
import { ActivityService } from "./common/activity.service";
import { ApiScopesGuard } from "./common/api-scopes.guard";
import { ApiUsageInterceptor } from "./common/api-usage.interceptor";
import { OriginGuard } from "./common/origin.guard";
import { RateLimitGuard } from "./common/rate-limit.guard";
import { RolesGuard } from "./common/roles.guard";
import { DatabaseModule } from "./database.module";
import { HealthController } from "./health.controller";
import { RedisModule } from "./redis.module";
import { SettingsController } from "./settings/settings.controller";
import { UsersController } from "./users/users.controller";
import { WatchlistsController } from "./watchlists/watchlists.controller";
import { WatchlistsService } from "./watchlists/watchlists.service";
import { MarketDataModule } from "./market-data/market-data.module";
import { NewsController } from "./news/news.controller";

@Module({
  imports: [DatabaseModule, RedisModule, MarketDataModule],
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
    ActivityService,
    WatchlistsService,
    AlertsService,
    ApiKeysService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: ApiScopesGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: ApiUsageInterceptor },
  ],
})
export class AppModule {}
