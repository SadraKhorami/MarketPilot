import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AiSessionGuard } from "../ai/ai-session.guard";
import { MarketDataModule } from "../market-data/market-data.module";
import { BotAdminController } from "./bot-admin.controller";
import { BotCommandProcessorService } from "./bot-command-processor.service";
import { BotCommandsService } from "./bot-commands.service";
import { BotLinksService } from "./bot-links.service";
import { BotRateService } from "./bot-rate.service";
import { BotRepliesService } from "./bot-replies.service";
import { BotRuntimeService } from "./bot-runtime.service";
import { BotWebhooksController } from "./bot-webhooks.controller";
import { BotsController } from "./bots.controller";
@Module({
  imports: [AiModule, MarketDataModule],
  controllers: [BotsController, BotWebhooksController, BotAdminController],
  providers: [
    AiSessionGuard,
    BotLinksService,
    BotRateService,
    BotCommandsService,
    BotCommandProcessorService,
    BotRepliesService,
    BotRuntimeService,
  ],
})
export class BotsModule {}
