import {
  AIError,
  type AIMessage,
  type AIProvider,
  conductResearch,
  permitsTradeSetup,
  ResearchResultSchema,
  type StreamEvent,
  TradeContextSchema,
} from "@marketpilot/ai";
import { type AiRun, Prisma } from "@marketpilot/db";
import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { EntitlementsService } from "../billing/entitlements.service";

import { DatabaseService } from "../database.module";
import { AiSettingsService } from "./ai-settings.service";
import { AiBudgetService } from "./ai-budget.service";
import { AiProposalsService, serializeProposal } from "./ai-proposals.service";
import { AiToolsService } from "./ai-tools.service";
import type { ResearchDto } from "./ai.dto";
import { recordedJournalRisk } from "./journal-risk";

export const AI_PROVIDER = Symbol("AI_PROVIDER");
export function aiConfiguration() {
  const missing = ["OPENROUTER_API_KEY", "OPENROUTER_MODEL"].filter((key) => !process.env[key]?.trim());
  const validUrl =
    !process.env.OPENROUTER_BASE_URL || process.env.OPENROUTER_BASE_URL === "https://openrouter.ai/api/v1";
  return { configured: !missing.length && validUrl, missing, validUrl };
}
@Injectable()
export class AiService {
  constructor(
    private readonly db: DatabaseService,
    private readonly tools: AiToolsService,
    private readonly budget: AiBudgetService,
    private readonly proposals: AiProposalsService,
    @Inject(AI_PROVIDER) private readonly provider: AIProvider | null,
    private readonly entitlements: EntitlementsService,
    private readonly settings: AiSettingsService,
  ) {}
  status() {
    const config = aiConfiguration();
    return {
      configured: config.configured,
      status: config.configured ? "configured" : "unavailable",
      message: config.configured
        ? "Provider configured. Model capability and availability are checked for each research request."
        : !config.validUrl
          ? "The server's provider URL configuration is unsupported."
          : `AI research is unavailable: ${config.missing.map((k) => (k === "OPENROUTER_API_KEY" ? "provider key" : "model")).join(" and ")} not configured.`,
      retentionDays: 7,
      sentiment: false,
      alertEvaluation: false,
    };
  }
  async userStatus(userId: string) {
    const saved = await this.settings.view(userId);
    if (saved.source !== "personal") return this.status();
    const configured = saved.hasKey && !!saved.modelId && saved.credentialStorageReady;
    return {
      ...this.status(),
      configured,
      status: configured ? "configured" : "unavailable",
      message: configured ? "Using your personal OpenRouter key." : "Reconnect your personal key in AI settings.",
    };
  }
  async history(userId: string, conversationId: string) {
    const runs = await this.db.aiRun.findMany({
      where: { userId, conversationId, purpose: "research", deletedAt: null, expiresAt: { gt: new Date() } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      include: { proposals: true },
    });
    const journalEntries = await this.db.journalEntry.findMany({
      where: { userId, runId: { in: runs.map((run) => run.id) } },
      select: { id: true, runId: true },
    });
    const journalByRun = new Map(journalEntries.map((entry) => [entry.runId, entry.id]));
    return runs.reverse().map((run) => ({
      archived: !!run.archivedAt,
      requestId: run.requestId,
      input: run.input,
      status: run.status === "running" && run.createdAt.getTime() < Date.now() - 120_000 ? "interrupted" : run.status,
      errorCode:
        run.status === "running" && run.createdAt.getTime() < Date.now() - 120_000 ? "AI_INTERRUPTED" : run.errorCode,
      result: this.readResult(run, journalByRun.get(run.id) ?? null),
      createdAt: run.createdAt,
      tradeContext: run.tradeContext,
    }));
  }
  private readResult(
    run: AiRun & { proposals: Parameters<typeof serializeProposal>[0][] },
    journalEntryId: string | null = null,
  ) {
    if (run.status !== "completed") return null;
    const parsed = ResearchResultSchema.safeParse(run.result);
    if (!parsed.success) return null;
    return {
      ...parsed.data,
      journalEntryId,
      proposals: run.proposals.map((proposal) => ({
        ...serializeProposal(proposal),
        interval: parsed.data.proposals.find((saved) => saved.id === proposal.id)?.interval,
      })),
    };
  }
  async research(userId: string, dto: ResearchDto, signal: AbortSignal, emit: (event: StreamEvent) => void) {
    const input = dto.input.trim();
    const tradeContext = dto.tradeContext ? TradeContextSchema.safeParse(dto.tradeContext) : null;
    if (permitsTradeSetup(input) && !tradeContext?.success)
      throw new AIError("AI_INPUT_CONTEXT", "Confirm your timeframe and risk context before requesting a trade plan.");
    if (!input) throw new AIError("AI_INPUT_EMPTY", "Enter a research question.");
    const inputHash = createHash("sha256")
      .update(
        JSON.stringify([
          input,
          dto.conversationId,
          dto.watchlistId ?? null,
          tradeContext?.success ? tradeContext.data : null,
        ]),
      )
      .digest("hex");
    const existing = await this.db.aiRun.findUnique({
      where: { userId_requestId: { userId, requestId: dto.requestId } },
      include: { proposals: true },
    });
    if (existing) {
      if (existing.deletedAt) throw new AIError("AI_REQUEST_FINISHED", "This conversation was deleted.");
      if (existing.inputHash !== inputHash)
        throw new AIError("AI_REQUEST_CONFLICT", "This request ID was already used for another question.");
      if (existing.expiresAt <= new Date())
        throw new AIError("AI_REQUEST_EXPIRED", "This research request has expired.");
      const journalEntry = await this.db.journalEntry.findUnique({
        where: { userId_runId: { userId, runId: existing.id } },
        select: { id: true },
      });
      const result = this.readResult(existing, journalEntry?.id ?? null);
      if (result) {
        emit({ type: "result", result });
        return;
      }
      throw new AIError(
        existing.status === "running" ? "AI_BUSY" : "AI_REQUEST_FINISHED",
        existing.status === "running"
          ? "This request is already running. Its result will appear in conversation history."
          : "This research request ended. Retry with a new request.",
      );
    }
    const resolved = await this.settings.resolve(userId, this.provider);
    const provider = resolved.provider;
    if (!provider) throw new AIError("AI_NOT_CONFIGURED", this.status().message);
    const config = await provider.check(signal);
    const release = await this.budget.acquire(userId, resolved.personal ? 0 : config.reservationUsd);
    let run: AiRun | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd: number | null = null;
    let toolCount = 0;
    const start = Date.now();
    try {
      signal.throwIfAborted();
      run = await this.entitlements.locked(userId, async (tx) => {
        const conversation = await tx.aiRun.findFirst({
          where: { userId, conversationId: dto.conversationId, purpose: "research" },
          select: { archivedAt: true, deletedAt: true },
        });
        if (conversation?.archivedAt || conversation?.deletedAt)
          throw new AIError(
            "AI_REQUEST_FINISHED",
            "This conversation is archived or deleted. Restore it or start a new chat.",
          );
        if (!resolved.personal) await this.entitlements.consumeIn(tx, userId, "ai");
        return tx.aiRun.create({
          data: {
            userId,
            requestId: dto.requestId,
            conversationId: dto.conversationId,
            input,
            inputHash,
            ...(tradeContext?.success ? { tradeContext: tradeContext.data as Prisma.InputJsonValue } : {}),
            status: "running",
            model: provider.model,
            billingSource: resolved.personal ? "personal" : "platform",
            reservedUsd: config.reservationUsd,
            expiresAt: new Date(Date.now() + 7 * 86400_000),
          },
        });
      });
      const prior = await this.db.aiRun.findMany({
        where: {
          userId,
          conversationId: dto.conversationId,
          deletedAt: null,
          status: "completed",
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        take: tradeContext?.success ? 1 : 2,
        select: { input: true, result: true, tradeContext: true },
      });
      const history: AIMessage[] = prior.reverse().flatMap((item) => {
        if (tradeContext?.success) {
          const previousContext = TradeContextSchema.safeParse(item.tradeContext);
          if (!previousContext.success || previousContext.data.symbol !== tradeContext.data.symbol) return [];
        }
        const parsed = ResearchResultSchema.safeParse(item.result);
        return parsed.success
          ? [
              { role: "user" as const, content: item.input.slice(0, 1000) },
              {
                role: "assistant" as const,
                content: JSON.stringify({
                  untrustedPriorInterpretation: parsed.data.answer.interpretation
                    .map((i) => i.text)
                    .join(" ")
                    .slice(0, 1000),
                  notice: "Prior observations are not current evidence. Retrieve new data.",
                }),
              },
            ]
          : [];
      });
      emit({ type: "progress", message: "Researching authorized MarketPilot sources…" });
      const runId = run.id;
      const research = await conductResearch({
        provider,
        preferences: { language: resolved.preferences.language, memory: resolved.preferences.memory },
        input,
        tradeContext: tradeContext?.success ? tradeContext.data : undefined,
        history,
        signal,
        execute: (() => {
          const context = {
            userId,
            runId,
            signal,
            watchlistId: dto.watchlistId,
            snapshots: new Map(),
            readOpenRisk: async (quote: string) =>
              recordedJournalRisk(
                await this.db.journalEntry.findMany({
                  where: { userId, status: "open" },
                  include: { exits: true },
                }),
                quote,
              ),
            tradeSymbol: tradeContext?.success ? tradeContext.data.symbol : undefined,
            tradeInterval: tradeContext?.success ? tradeContext.data.interval : undefined,
            tradeContext: tradeContext?.success ? tradeContext.data : undefined,
            propose: (args: unknown) => this.proposals.propose(userId, runId, args),
          };
          return (tool, args) => this.tools.execute(tool, args, context);
        })(),
        emit: (event) => {
          if (event.type === "tool" && event.state === "running") toolCount++;
          emit(event);
        },
        usage: (incoming, outgoing, cost) => {
          inputTokens += incoming;
          outputTokens += outgoing;
          if (cost !== null) costUsd = (costUsd ?? 0) + cost;
        },
      });
      signal.throwIfAborted();
      const result = ResearchResultSchema.parse({
        runId,
        conversationId: dto.conversationId,
        answer: research.answer,
        sources: [...new Map(research.results.flatMap((r) => r.sources.map((s) => [s.id, s] as const))).values()],
        proposals: research.results.flatMap((r) => (r.proposal ? [r.proposal] : [])),
        tradeSetup: research.results.find((r) => r.tradeSetup)?.tradeSetup ?? null,
        tools: research.tools,
      });
      await this.db.aiRun.update({
        where: { id: runId },
        data: {
          status: "completed",
          result: result as unknown as Prisma.InputJsonValue,
          inputTokens,
          outputTokens,
          costUsd,
          toolCount,
          latencyMs: Date.now() - start,
        },
      });
      emit({ type: "result", result });
    } catch (error) {
      const safe = signal.aborted
        ? new AIError(
            signal.reason?.name === "TimeoutError" ? "AI_TIMEOUT" : "AI_CANCELLED",
            signal.reason?.name === "TimeoutError"
              ? "Research timed out. Ask a narrower question."
              : "Research was cancelled.",
          )
        : error instanceof ForbiddenException
          ? new AIError(
              "AI_PLAN_LIMIT",
              "Your daily plan research allowance has been reached. Manage your plan in Billing; usage resets at 00:00 UTC.",
            )
          : error instanceof AIError
            ? error
            : new AIError("AI_RESEARCH_FAILED", "Research could not be completed. Try again.");
      if (run)
        await this.db.aiRun.update({
          where: { id: run.id },
          data: {
            status: signal.aborted ? "cancelled" : "failed",
            errorCode: safe.code,
            inputTokens,
            outputTokens,
            costUsd,
            toolCount,
            latencyMs: Date.now() - start,
          },
        });
      throw safe;
    } finally {
      await release(!run);
    }
  }
  async cleanup() {
    // Bounded, request-triggered retention cleanup. No background job or content logging.
    const expired = await this.db.aiRun.findMany({
      where: { expiresAt: { lte: new Date() } },
      take: 100,
      select: { id: true },
    });
    if (expired.length) await this.db.aiRun.deleteMany({ where: { id: { in: expired.map((r) => r.id) } } });
    await this.db.aiRun.updateMany({
      where: { status: "running", createdAt: { lt: new Date(Date.now() - 120_000) } },
      data: { status: "failed", errorCode: "AI_INTERRUPTED" },
    });
  }
  async metrics() {
    const where = { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } };
    const [statuses, totals] = await Promise.all([
      this.db.aiRun.groupBy({ by: ["status"], where, _count: true }),
      this.db.aiRun.aggregate({
        where,
        _sum: { inputTokens: true, outputTokens: true, costUsd: true, reservedUsd: true, toolCount: true },
        _avg: { latencyMs: true },
      }),
    ]);
    return {
      days: 7,
      statuses: statuses.map((s) => ({ status: s.status, count: s._count })),
      ...totals,
      provider: this.status(),
    };
  }
}
