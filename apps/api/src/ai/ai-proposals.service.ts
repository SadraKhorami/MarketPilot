import { AIError, AlertInputSchema, type Proposal, ProposalSchema } from "@marketpilot/ai";
import { Prisma } from "@marketpilot/db";
import { Injectable } from "@nestjs/common";
import { AlertsService } from "../alerts/alerts.service";
import { DatabaseService } from "../database.module";
import type { ProposalDecisionDto } from "./ai.dto";

@Injectable()
export class AiProposalsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly alerts: AlertsService,
  ) {}
  async propose(userId: string, runId: string, input: unknown): Promise<Proposal> {
    const args = AlertInputSchema.parse(input);
    const run = await this.db.aiRun.findFirst({
      where: { id: runId, userId, status: "running" },
      select: { id: true },
    });
    if (!run) throw new AIError("AI_RUN_NOT_FOUND", "The research request is unavailable.");
    const existing = await this.db.aiAlertProposal.findUnique({ where: { runId } });
    if (existing) throw new AIError("AI_PROPOSAL_LIMIT", "Only one alert proposal is allowed per research request.");
    const proposal = await this.db.aiAlertProposal.create({
      data: {
        runId,
        symbol: args.symbol,
        condition: args.condition,
        threshold: new Prisma.Decimal(args.threshold),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    return serializeProposal(proposal);
  }
  async decide(userId: string, id: string, input: ProposalDecisionDto) {
    return this.db.$transaction(async (tx) => {
      const where = { id, runId: input.runId, run: { userId, status: "completed", expiresAt: { gt: new Date() } } };
      const proposal = await tx.aiAlertProposal.findFirst({ where });
      if (!proposal) throw new AIError("AI_PROPOSAL_NOT_FOUND", "The alert proposal is unavailable.");
      if (proposal.state !== "pending") {
        if (
          (proposal.state === "confirmed" && input.decision === "confirm") ||
          (proposal.state === "cancelled" && input.decision === "cancel")
        )
          return serializeProposal(proposal);
        throw new AIError("AI_PROPOSAL_RESOLVED", "This alert proposal has already been resolved.");
      }
      if (proposal.expiresAt <= new Date())
        throw new AIError("AI_PROPOSAL_EXPIRED", "This alert proposal expired. Request a new proposal.");
      const args = AlertInputSchema.parse({
        symbol: proposal.symbol,
        condition: proposal.condition,
        threshold: Number(proposal.threshold),
      });
      const state = input.decision === "confirm" ? "confirmed" : "cancelled";
      const claim = await tx.aiAlertProposal.updateMany({
        where: { ...where, state: "pending", expiresAt: { gt: new Date() } },
        data: { state },
      });
      if (!claim.count) {
        const current = await tx.aiAlertProposal.findFirst({ where });
        if (current?.state === state) return serializeProposal(current);
        throw new AIError("AI_PROPOSAL_RESOLVED", "This proposal changed or expired. Review its current status.");
      }
      let alertId: string | null = null;
      if (input.decision === "confirm") {
        const alert = await this.alerts.create(
          userId,
          {
            name: `${args.symbol} ${args.condition.toLowerCase().replaceAll("_", " ")}`,
            assetId: args.symbol,
            condition: args.condition,
            threshold: args.threshold,
            enabled: true,
            cooldownMinutes: 60,
          },
          tx,
        );
        alertId = alert.id;
      }
      const saved = await tx.aiAlertProposal.update({ where: { id }, data: { alertId } });
      return serializeProposal(saved);
    });
  }
}
export function serializeProposal(proposal: {
  id: string;
  runId: string;
  symbol: string;
  condition: string;
  threshold: { toString(): string };
  state: string;
  alertId: string | null;
  expiresAt: Date;
}): Proposal {
  return ProposalSchema.parse({
    threshold: Number(proposal.threshold.toString()),
    expiresAt: proposal.expiresAt.toISOString(),
    id: proposal.id,
    runId: proposal.runId,
    symbol: proposal.symbol,
    condition: proposal.condition,
    state: proposal.state,
    alertId: proposal.alertId,
  });
}
