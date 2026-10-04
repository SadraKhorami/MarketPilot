import { AIError, entryAlertApproach, permitsTradeSetup, ResearchResultSchema } from "@marketpilot/ai";
import { Prisma } from "@marketpilot/db";
import { Injectable } from "@nestjs/common";
import { AlertsService } from "../alerts/alerts.service";
import { DatabaseService } from "../database.module";
import { MarketDataService } from "../market-data/market-data.service";
import type { EntryAlertDto } from "./ai.dto";
import { serializeProposal } from "./ai-proposals.service";
import { scenarioPriceDecimals } from "./trade-setup";

@Injectable()
export class EntryAlertsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly alerts: AlertsService,
    private readonly market: MarketDataService,
  ) {}

  async create(userId: string, runId: string, input: EntryAlertDto) {
    const run = await this.db.aiRun.findFirst({
      where: { id: runId, userId, status: "completed", expiresAt: { gt: new Date() } },
    });
    if (!run) throw new AIError("AI_RUN_NOT_FOUND", "This scenario is unavailable.");
    const result = ResearchResultSchema.safeParse(run.result);
    const plan = result.success ? result.data.tradeSetup : null;
    if (!plan || !permitsTradeSetup(run.input))
      throw new AIError("AI_INPUT_INVALID", "This request has no validated trade scenario.");
    if (!input.confirm) throw new AIError("AI_INPUT_INVALID", "Confirm the displayed rule before saving it.");
    const offset = input.distance * (input.unit === "pips" ? (plan.pipSize ?? 0) : 1);
    if (!Number.isFinite(offset) || offset <= 0 || offset >= Math.abs(plan.entry - plan.stopLoss))
      throw new AIError(
        "AI_INPUT_INVALID",
        "Choose a positive distance smaller than the entry-to-stop distance. Pips are available only for instruments with a defined convention.",
      );
    const buy = plan.direction === "BUY";
    const { fromBelow, gap } = entryAlertApproach(plan);
    if (offset >= gap)
      throw new AIError("AI_INPUT_INVALID", "Choose a warning distance smaller than the observed gap to Entry.");
    const threshold = Number((plan.entry + (fromBelow ? -offset : offset)).toFixed(scenarioPriceDecimals(plan.symbol)));
    if (threshold === plan.entry)
      throw new AIError("AI_INPUT_INVALID", "The warning distance is smaller than this scenario's price precision.");
    const condition = fromBelow ? "PRICE_ABOVE" : "PRICE_BELOW";
    const existing = await this.db.aiAlertProposal.findUnique({ where: { runId } });
    if (existing) {
      if (
        existing.state === "confirmed" &&
        result.success &&
        result.data.proposals.some((proposal) => proposal.id === existing.id && proposal.interval === "1m") &&
        existing.condition === condition &&
        Number(existing.threshold) === threshold
      )
        return { ...serializeProposal(existing), interval: "1m" as const };
      throw new AIError("AI_PROPOSAL_CONFLICT", "This research already has an alert. Review it in Alerts.");
    }
    if (Date.parse(plan.expiresAt) <= Date.now())
      throw new AIError("AI_SCENARIO_EXPIRED", "This scenario expired. Request a fresh one before saving an alert.");
    const snapshot = await this.market.getMarketData(plan.symbol, "1m");
    const age = Date.now() - Date.parse(snapshot.data.timestamp);
    if (
      snapshot.freshness !== "fresh" ||
      snapshot.requestedSymbol !== plan.symbol ||
      snapshot.data.symbol !== plan.symbol ||
      snapshot.data.interval !== "1m" ||
      age < -60_000 ||
      age > 120_000
    )
      throw new AIError("AI_INPUT_INVALID", "Fresh market observations are required before this alert can be saved.");
    if (fromBelow ? snapshot.data.price >= threshold : snapshot.data.price <= threshold)
      throw new AIError(
        "AI_ENTRY_REACHED",
        "Price has already reached the chosen warning level. Request a new scenario or use a smaller distance.",
      );
    if (buy ? snapshot.data.price <= plan.stopLoss : snapshot.data.price >= plan.stopLoss)
      throw new AIError(
        "AI_SCENARIO_EXPIRED",
        "The latest observation invalidated this scenario. Request a fresh one.",
      );
    return this.db.$transaction(async (tx) => {
      // Serialize repeat clicks on the owned run; alert and confirmation commit together.
      await tx.$queryRaw`SELECT "id" FROM "AiRun" WHERE "id" = ${runId}::uuid AND "userId" = ${userId}::uuid FOR UPDATE`;
      const owned = await tx.aiRun.findFirst({
        where: { id: runId, userId, status: "completed", expiresAt: { gt: new Date() } },
      });
      if (!owned || Date.parse(plan.expiresAt) <= Date.now())
        throw new AIError("AI_SCENARIO_EXPIRED", "This scenario expired before confirmation.");
      const current = await tx.aiAlertProposal.findUnique({ where: { runId } });
      if (current) {
        const savedResult = ResearchResultSchema.safeParse(owned.result);
        if (
          current.state === "confirmed" &&
          savedResult.success &&
          savedResult.data.proposals.some((proposal) => proposal.id === current.id && proposal.interval === "1m") &&
          current.condition === condition &&
          Number(current.threshold) === threshold
        )
          return { ...serializeProposal(current), interval: "1m" as const };
        throw new AIError("AI_PROPOSAL_CONFLICT", "An alert already exists for this research.");
      }
      const alert = await this.alerts.create(
        userId,
        {
          name: `${plan.symbol} approaching ${plan.direction} entry`,
          assetId: plan.symbol,
          condition,
          threshold,
          interval: "1m",
          enabled: true,
          cooldownMinutes: 60,
        },
        tx,
      );
      const saved = await tx.aiAlertProposal.create({
        data: {
          runId,
          symbol: plan.symbol,
          condition,
          threshold,
          state: "confirmed",
          alertId: alert.id,
          expiresAt: new Date(plan.expiresAt),
        },
      });
      const proposal = { ...serializeProposal(saved), interval: "1m" as const };
      if (!result.success) throw new AIError("AI_INPUT_INVALID", "The saved research is unavailable.");
      await tx.aiRun.update({
        where: { id: runId },
        data: {
          result: { ...result.data, proposals: [proposal] } as unknown as Prisma.InputJsonValue,
        },
      });
      return proposal;
    });
  }
}
