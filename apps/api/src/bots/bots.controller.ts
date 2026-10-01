import { type BotProvider, botProviders } from "@marketpilot/bots";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsUUID } from "class-validator";
import type { Response } from "express";
import { AiSessionGuard } from "../ai/ai-session.guard";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser } from "../common/auth";
import { PageQueryDto, pageResult } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
import { BotLinksService } from "./bot-links.service";
export function parseProvider(value: string): BotProvider {
  const provider = botProviders.find((item) => item.toLowerCase() === value.toLowerCase());
  if (!provider) throw new BadRequestException("Unknown bot provider.");
  return provider;
}
class ConfirmLinkDto {
  @IsUUID() id!: string;
}
class BotPreferencesDto {
  @IsBoolean() marketAlerts!: boolean;
}
@ApiTags("Bots")
@ApiSessionAuth()
@ApiStandardResponses()
@UseGuards(AiSessionGuard)
@Controller("bots")
export class BotsController {
  constructor(
    private readonly links: BotLinksService,
    private readonly db: DatabaseService,
  ) {}
  @Get(":provider") async state(@CurrentUser() user: AuthenticatedUser, @Param("provider") provider: string) {
    return { data: await this.links.state(user.id, parseProvider(provider)) };
  }
  @Post(":provider/link") async link(
    @CurrentUser() user: AuthenticatedUser,
    @Param("provider") provider: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.set("Cache-Control", "no-store");
    return { data: await this.links.initiate(user.id, parseProvider(provider)) };
  }
  @Post(":provider/confirm") async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("provider") provider: string,
    @Body() body: ConfirmLinkDto,
  ) {
    return { data: await this.links.confirm(user.id, parseProvider(provider), body.id) };
  }
  @Delete(":provider/link") async disconnect(
    @CurrentUser() user: AuthenticatedUser,
    @Param("provider") provider: string,
  ) {
    return { data: await this.links.disconnect(user.id, parseProvider(provider)) };
  }
  @Patch(":provider/preferences") async preferences(
    @CurrentUser() user: AuthenticatedUser,
    @Param("provider") provider: string,
    @Body() body: BotPreferencesDto,
  ) {
    return { data: await this.links.preferences(user.id, parseProvider(provider), body.marketAlerts) };
  }
  @Get(":provider/deliveries") async deliveries(
    @CurrentUser() user: AuthenticatedUser,
    @Param("provider") provider: string,
    @Query() query: PageQueryDto,
  ) {
    const where = { userId: user.id, provider: parseProvider(provider) };
    const [items, total] = await Promise.all([
      this.db.externalDelivery.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          status: true,
          attempts: true,
          failureCode: true,
          createdAt: true,
          deliveredAt: true,
          nextAttemptAt: true,
          receiptId: true,
          trigger: { select: { assetId: true, condition: true, alertId: true } },
        },
      }),
      this.db.externalDelivery.count({ where }),
    ]);
    return { data: pageResult(items, total, query) };
  }
}
