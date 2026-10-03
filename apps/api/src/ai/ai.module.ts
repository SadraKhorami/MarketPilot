import { OpenRouterProvider } from "@marketpilot/ai";
import { Module } from "@nestjs/common";
import { AlertsService } from "../alerts/alerts.service";
import { ActivityService } from "../common/activity.service";
import { JournalMonitorService } from "../journal/journal-monitor.service";
import { JournalController } from "../journal/journal.controller";
import { JournalAssistantService } from "../journal/journal-assistant.service";
import { JournalTradesService } from "../journal/journal-trades.service";
import { JournalImportService } from "../journal/journal-import.service";
import { JournalService } from "../journal/journal.service";
import { MarketDataModule } from "../market-data/market-data.module";
import { NewsService } from "../news/news.service";
import { WatchlistsService } from "../watchlists/watchlists.service";
import { AiConversationsService } from "./ai-conversations.service";
import { AiModelsService } from "./ai-models.service";
import { AiSettingsController } from "./ai-settings.controller";
import { AiSettingsService } from "./ai-settings.service";
import { AiBudgetService } from "./ai-budget.service";
import { AiProposalsService } from "./ai-proposals.service";
import { AiSessionGuard } from "./ai-session.guard";
import { AiToolsService } from "./ai-tools.service";
import { AiController } from "./ai.controller";
import { AI_PROVIDER, AiService, aiConfiguration } from "./ai.service";
import { EntryAlertsService } from "./entry-alerts.service";
@Module({
  imports: [MarketDataModule],
  controllers: [AiController, AiSettingsController, JournalController],
  exports: [AiService],
  providers: [
    AiService,
    AiSettingsService,
    AiModelsService,
    AiConversationsService,
    JournalService,
    JournalTradesService,
    JournalAssistantService,
    JournalImportService,
    JournalMonitorService,
    AiToolsService,
    EntryAlertsService,
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
