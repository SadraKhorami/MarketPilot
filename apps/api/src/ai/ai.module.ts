import { OpenRouterProvider } from "@marketpilot/ai";
import { Module } from "@nestjs/common";
import { AlertsService } from "../alerts/alerts.service";
import { ActivityService } from "../common/activity.service";
import { MarketDataModule } from "../market-data/market-data.module";
import { NewsService } from "../news/news.service";
import { WatchlistsService } from "../watchlists/watchlists.service";
import { AiController } from "./ai.controller";
import { AI_PROVIDER, AiService, aiConfiguration } from "./ai.service";
import { AiBudgetService } from "./ai-budget.service";
import { AiProposalsService } from "./ai-proposals.service";
import { AiSessionGuard } from "./ai-session.guard";
import { AiToolsService } from "./ai-tools.service";
@Module({
  imports: [MarketDataModule],
  controllers: [AiController],
  exports: [AiService],
  providers: [
    AiService,
    AiToolsService,
    AiBudgetService,
    AiProposalsService,
    AiSessionGuard,
    AlertsService,
    ActivityService,
    WatchlistsService,
    NewsService,
    {
      provide: AI_PROVIDER,
      useFactory: () =>
        aiConfiguration().configured
          ? new OpenRouterProvider(
              process.env.OPENROUTER_MODEL?.trim() ?? "",
              process.env.OPENROUTER_API_KEY?.trim() ?? "",
              process.env.OPENROUTER_BASE_URL,
            )
          : null,
    },
  ],
})
export class AiModule {}
