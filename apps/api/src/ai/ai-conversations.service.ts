import { AIError } from "@marketpilot/ai";
import { Prisma } from "@marketpilot/db";
import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { EntitlementsService } from "../billing/entitlements.service";
import { pageResult, type PageQueryDto } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
const changeSchema = z
  .object({
    action: z.enum(["archive", "restore", "delete"]),
    scope: z.enum(["selected", "all"]),
    ids: z.array(z.string().uuid()).min(1).max(50).optional(),
  })
  .strict()
  .refine((value) => value.scope === "all" || !!value.ids?.length);
@Injectable()
export class AiConversationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
  ) {}
  async list(userId: string, query: PageQueryDto, archived: boolean) {
    const search = `%${query.search?.trim() ?? ""}%`;
    const eligible = Prisma.sql`
      SELECT "conversationId", (array_agg(input ORDER BY "createdAt", id))[1] AS title,
        MAX("createdAt") AS "updatedAt", COUNT(*)::int AS "turnCount", bool_or("archivedAt" IS NOT NULL) AS archived
      FROM "AiRun" WHERE "userId" = ${userId}::uuid AND purpose = 'research' AND "deletedAt" IS NULL AND "expiresAt" > ${new Date()}
      GROUP BY "conversationId" HAVING bool_or(input ILIKE ${search}) AND bool_or("archivedAt" IS NOT NULL) = ${archived}`;
    const [items, count] = await Promise.all([
      this.db.$queryRaw<
        Array<{ conversationId: string; title: string; updatedAt: Date; turnCount: number; archived: boolean }>
      >`
        SELECT * FROM (${eligible}) conversations ORDER BY "updatedAt" DESC, "conversationId"
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      this.db.$queryRaw<Array<{ total: number }>>`SELECT COUNT(*)::int AS total FROM (${eligible}) conversations`,
    ]);
    return pageResult(items, count[0]?.total ?? 0, query);
  }
  async change(userId: string, body: unknown) {
    const parsed = changeSchema.safeParse(body);
    if (!parsed.success) throw new AIError("AI_INPUT_CONVERSATIONS", "Choose conversations and an action.");
    const { action, scope, ids } = parsed.data;
    return this.entitlements.locked(userId, async (tx) => {
      const where = {
        userId,
        purpose: "research",
        deletedAt: null,
        expiresAt: { gt: new Date() },
        ...(scope === "selected" ? { conversationId: { in: ids } } : {}),
      };
      if (
        await tx.aiRun.count({
          where: { ...where, status: "running", createdAt: { gt: new Date(Date.now() - 120_000) } },
        })
      )
        throw new AIError("AI_BUSY", "Wait for research to finish before changing these conversations.");
      if (action === "delete") {
        // Preserve usage and independent journal/alert records; erase private conversation content.
        await tx.aiAlertProposal.updateMany({ where: { state: "pending", run: where }, data: { state: "cancelled" } });
      }
      const result = await tx.aiRun.updateMany({
        where,
        data:
          action === "delete"
            ? { deletedAt: new Date(), input: "", result: Prisma.DbNull, tradeContext: Prisma.DbNull }
            : { archivedAt: action === "archive" ? new Date() : null },
      });
      return { affectedTurns: result.count };
    });
  }
  async *export(userId: string, conversationId?: string) {
    const cutoff = new Date();
    let cursor: string | undefined;
    while (true) {
      const rows = await this.db.aiRun.findMany({
        where: {
          userId,
          purpose: "research",
          deletedAt: null,
          expiresAt: { gt: cutoff },
          createdAt: { lte: cutoff },
          ...(conversationId ? { conversationId } : {}),
        },
        orderBy: { id: "asc" },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          conversationId: true,
          input: true,
          status: true,
          result: true,
          createdAt: true,
          archivedAt: true,
          model: true,
        },
      });
      if (!rows.length) return;
      for (const row of rows) yield row;
      cursor = rows.at(-1)!.id;
    }
  }
}
