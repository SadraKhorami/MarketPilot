import { AIError, type StreamEvent } from "@marketpilot/ai";
import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser, Roles } from "../common/auth";
import { ProposalDecisionDto, ResearchDto } from "./ai.dto";
import { AiService } from "./ai.service";
import { AiProposalsService } from "./ai-proposals.service";
import { AiSessionGuard } from "./ai-session.guard";

export function aiHttpError(error: unknown) {
  const safe =
    error instanceof AIError ? error : new AIError("AI_UNAVAILABLE", "The research operation could not be completed.");
  const status = /NOT_FOUND/.test(safe.code)
    ? 404
    : /BUSY|CONFLICT|RESOLVED|EXPIRED|FINISHED/.test(safe.code)
      ? 409
      : /RATE_LIMITED|BUDGET/.test(safe.code)
        ? 429
        : /INPUT/.test(safe.code)
          ? 400
          : 503;
  return new HttpException({ error: { code: safe.code, message: safe.message } }, status);
}
@ApiTags("AI Analyst")
@ApiSessionAuth()
@ApiStandardResponses()
@UseGuards(AiSessionGuard)
@Controller("ai")
export class AiController {
  constructor(
    private readonly service: AiService,
    private readonly proposals: AiProposalsService,
  ) {}
  @Get("status")
  @ApiOperation({ summary: "Browser session: AI configuration status; no provider secrets" })
  status() {
    return { data: this.service.status() };
  }
  @Get("history")
  @ApiOperation({ summary: "Browser session: last 20 owned conversation turns, retained for seven days" })
  async history(
    @CurrentUser() user: AuthenticatedUser,
    @Query("conversationId", ParseUUIDPipe) conversationId: string,
  ) {
    return { data: await this.service.history(user.id, conversationId) };
  }
  @Post("research")
  @ApiProduces("text/event-stream")
  @ApiOperation({
    summary: "Browser session: bounded market research with honest tool progress and a validated final answer",
    description:
      "POST SSE. Each data frame is a StreamEvent: progress {message}, tool {tool,state,status?}, result {result}, or error {code,message}. Exactly one terminal result/error. No raw tokens or hidden reasoning. Reuse requestId to recover a completed result without another provider run. Read /ai/history after a connection interruption. API keys are forbidden.",
  })
  @ApiResponse({
    status: 200,
    description:
      "Typed progress/tool/result/error SSE frames. Provider errors after opening the stream are terminal error frames.",
  })
  async research(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResearchDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    if (!this.service.status().configured)
      throw aiHttpError(new AIError("AI_NOT_CONFIGURED", this.service.status().message));
    await this.service.cleanup();
    const abort = new AbortController();
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(90_000)]);
    const close = () => {
      if (!response.writableEnded) abort.abort();
    };
    response.once("close", close);
    request.once("aborted", close);
    response.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.flushHeaders();
    const emit = (event: StreamEvent) => {
      if (!response.destroyed && !response.writableEnded) response.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const heartbeat = setInterval(() => {
      if (!response.destroyed) response.write(": pending\n\n");
    }, 10_000);
    try {
      await this.service.research(user.id, dto, signal, emit);
    } catch (error) {
      const safe =
        error instanceof AIError ? error : new AIError("AI_UNAVAILABLE", "Research could not be completed. Try again.");
      emit({ type: "error", code: safe.code, message: safe.message });
    } finally {
      clearInterval(heartbeat);
      response.off("close", close);
      request.off("aborted", close);
      response.end();
    }
  }
  @Post("proposals/:id/decision")
  @ApiOperation({
    summary: "Browser session: confirm or cancel an owned expiring alert proposal",
    description:
      "Only proposal ID, bound run ID and decision are accepted. Terms are loaded from the server. Confirmation is atomic and idempotent. Saved rules are not evaluated or delivered in this phase.",
  })
  async decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ProposalDecisionDto,
  ) {
    try {
      return { data: await this.proposals.decide(user.id, id, dto) };
    } catch (error) {
      throw aiHttpError(error);
    }
  }
  @Roles("ADMIN")
  @Get("metrics")
  @ApiOperation({
    summary:
      "ADMIN browser session: seven-day AI usage, tool counts, latency and actual reported cost; no private content",
  })
  async metrics() {
    return { data: await this.service.metrics() };
  }
}
