import { Prisma } from "@marketpilot/db";
import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { pageResult } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
import { AnnouncementInputDto, AnnouncementQueryDto, UpdateAnnouncementDto } from "./announcement.dto";

const select = {
  id: true,
  title: true,
  body: true,
  actionPath: true,
  severity: true,
  audience: true,
  status: true,
  recipientCount: true,
  excludedCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { name: true, email: true } },
} as const;
const inputData = (input: AnnouncementInputDto) => ({
  ...input,
  title: input.title.trim(),
  body: input.body.trim(),
  actionPath: input.actionPath ?? null,
});
const audit = (userId: string, eventType: string, description: string, id: string) => ({
  userId,
  eventType,
  description,
  metadata: { announcementId: id },
});
function audienceWhere(audience: "ALL" | "USERS" | "ADMINS"): Prisma.UserWhereInput {
  return {
    status: "ACTIVE",
    ...(audience === "ADMINS" ? { roles: { some: { role: { name: "ADMIN" } } } } : {}),
    ...(audience === "USERS" ? { roles: { none: { role: { name: "ADMIN" } } } } : {}),
  };
}
const eligibleWhere = (audience: Prisma.UserWhereInput): Prisma.UserWhereInput => ({
  ...audience,
  NOT: { channels: { some: { provider: "WEB", preferences: { path: ["inAppEnabled"], equals: false } } } },
});
@Injectable()
export class AnnouncementsService {
  constructor(private readonly db: DatabaseService) {}
  async audiencePreview(audience: "ALL" | "USERS" | "ADMINS") {
    const where = audienceWhere(audience);
    const [total, eligible] = await Promise.all([
      this.db.user.count({ where }),
      this.db.user.count({ where: eligibleWhere(where) }),
    ]);
    return { total, eligible, excluded: total - eligible };
  }
  async list(query: AnnouncementQueryDto) {
    const where: Prisma.NotificationAnnouncementWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { body: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.notificationAnnouncement.findMany({
        where,
        select,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.notificationAnnouncement.count({ where }),
    ]);
    const reads = items.length
      ? await this.db.notification.groupBy({
          by: ["announcementId"],
          where: { announcementId: { in: items.map((item) => item.id) }, readAt: { not: null } },
          _count: { id: true },
        })
      : [];
    const readCounts = new Map(reads.map((row) => [row.announcementId, row._count.id]));
    return pageResult(
      items.map((item) => ({ ...item, readCount: readCounts.get(item.id) ?? 0 })),
      total,
      query,
    );
  }
  async summary() {
    const [drafts, published, delivered, read] = await Promise.all([
      this.db.notificationAnnouncement.count({ where: { status: "DRAFT" } }),
      this.db.notificationAnnouncement.count({ where: { status: "PUBLISHED" } }),
      this.db.notification.count({ where: { announcementId: { not: null } } }),
      this.db.notification.count({ where: { announcementId: { not: null }, readAt: { not: null } } }),
    ]);
    return { drafts, published, delivered, read };
  }
  async create(userId: string, input: AnnouncementInputDto) {
    return this.db.$transaction(async (tx) => {
      const draft = await tx.notificationAnnouncement.create({
        data: { ...inputData(input), authorId: userId },
        select,
      });
      await tx.activityLog.create({
        data: audit(userId, "ANNOUNCEMENT_DRAFT_CREATED", "Saved a notification draft", draft.id),
      });
      return draft;
    });
  }
  async update(userId: string, id: string, input: UpdateAnnouncementDto) {
    const { expectedUpdatedAt, ...message } = input;
    return this.changeDraft(
      userId,
      id,
      inputData(message),
      "ANNOUNCEMENT_DRAFT_UPDATED",
      "Updated a notification draft",
      expectedUpdatedAt,
    );
  }
  async cancel(userId: string, id: string, expectedUpdatedAt: string) {
    return this.changeDraft(
      userId,
      id,
      { status: "CANCELLED" },
      "ANNOUNCEMENT_DRAFT_CANCELLED",
      "Cancelled a notification draft",
      expectedUpdatedAt,
    );
  }
  private async changeDraft(
    userId: string,
    id: string,
    data: Prisma.NotificationAnnouncementUpdateManyMutationInput,
    eventType: string,
    description: string,
    expectedUpdatedAt: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const result = await tx.notificationAnnouncement.updateMany({
        where: { id, status: "DRAFT", updatedAt: new Date(expectedUpdatedAt) },
        data,
      });
      if (!result.count) await this.draftConflict(tx, id);
      await tx.activityLog.create({ data: audit(userId, eventType, description, id) });
      return tx.notificationAnnouncement.findUniqueOrThrow({ where: { id }, select });
    });
  }
  private async draftConflict(tx: Prisma.TransactionClient, id: string): Promise<never> {
    if (!(await tx.notificationAnnouncement.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException("Announcement not found.");
    throw new ConflictException("The draft changed or is no longer editable. Reload and review it before continuing.");
  }
  async publish(userId: string, id: string, expectedUpdatedAt: string) {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const claim = await tx.notificationAnnouncement.updateMany({
            where: { id, status: "DRAFT", updatedAt: new Date(expectedUpdatedAt) },
            data: { status: "PUBLISHED", publishedAt: new Date() },
          });
          if (!claim.count) await this.draftConflict(tx, id);
          const announcement = await tx.notificationAnnouncement.findUniqueOrThrow({ where: { id } });
          const audience = audienceWhere(announcement.audience);
          const eligible = eligibleWhere(audience);
          const audienceCount = await tx.user.count({ where: audience });
          let cursor: string | undefined;
          let recipientCount = 0;
          while (true) {
            const users = await tx.user.findMany({
              where: { ...eligible, ...(cursor ? { id: { gt: cursor } } : {}) },
              select: { id: true },
              orderBy: { id: "asc" },
              take: 500,
            });
            if (!users.length) break;
            const result = await tx.notification.createMany({
              data: users.map((user) => ({
                userId: user.id,
                announcementId: id,
                category: "ANNOUNCEMENT" as const,
                severity: announcement.severity,
                title: announcement.title,
                body: announcement.body,
                actionPath: announcement.actionPath,
              })),
            });
            recipientCount += result.count;
            cursor = users[users.length - 1].id;
          }
          if (!recipientCount)
            throw new BadRequestException("No eligible recipients. Keep the draft until an account can receive it.");
          const sent = await tx.notificationAnnouncement.update({
            where: { id },
            data: { recipientCount, excludedCount: audienceCount - recipientCount },
            select,
          });
          await tx.activityLog.create({
            data: audit(
              userId,
              "ANNOUNCEMENT_PUBLISHED",
              `Published an in-app notice to ${recipientCount} accounts`,
              id,
            ),
          });
          return sent;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
        throw new ConflictException("The audience or draft changed. Review and retry publishing.");
      throw error;
    }
  }
}
