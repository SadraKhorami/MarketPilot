import { AIError } from "@marketpilot/ai";
import { once } from "node:events";
import { Body, Controller, Get, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";

import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser } from "../common/auth";
import { PageQueryDto } from "../common/request-query.dto";
import { AiConversationsService } from "./ai-conversations.service";
import { AiModelsService } from "./ai-models.service";
import { AiSettingsService } from "./ai-settings.service";
import { AiSessionGuard } from "./ai-session.guard";
import { aiHttpError } from "./ai.controller";
@ApiTags("AI Analyst")
@ApiSessionAuth()
@ApiStandardResponses()
@UseGuards(AiSessionGuard)
@Controller("ai")
export class AiSettingsController {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly models: AiModelsService,
    private readonly conversations: AiConversationsService,
  ) {}
  @Get("settings") async view(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.settings.view(user.id) };
  }
  @Patch("settings") async update(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    try {
      return { data: await this.settings.update(user.id, body) };
    } catch (error) {
      throw aiHttpError(error);
    }
  }
  @Get("models") async catalog(@Query() query: PageQueryDto) {
    try {
      return { data: await this.models.list(query) };
    } catch (error) {
      throw aiHttpError(error);
    }
  }
  @Post("conversations/manage") async manage(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    try {
      return { data: await this.conversations.change(user.id, body) };
    } catch (error) {
      throw aiHttpError(error);
    }
  }
  @Get("conversations/export") async export(
    @CurrentUser() user: AuthenticatedUser,
    @Query("conversationId") id: string | undefined,
    @Res() response: Response,
  ) {
    const parsed = z.string().uuid().optional().safeParse(id);
    if (!parsed.success) throw aiHttpError(new AIError("AI_INPUT_CONVERSATION", "Choose a valid conversation."));
    const conversationId = parsed.data;
    response.set({
      "Content-Type": "application/x-ndjson",
      "Content-Disposition": 'attachment; filename="marketpilot-research.ndjson"',
      "Cache-Control": "no-store",
    });
    try {
      for await (const row of this.conversations.export(user.id, conversationId)) {
        if (response.destroyed) return;
        if (!response.write(`${JSON.stringify(row)}\n`)) {
          const waiting = new AbortController();
          try {
            await Promise.race([
              once(response, "drain", { signal: waiting.signal }),
              once(response, "close", { signal: waiting.signal }),
            ]);
          } finally {
            waiting.abort();
          }
        }
      }
      response.end();
    } catch {
      response.destroy();
    }
  }
}
