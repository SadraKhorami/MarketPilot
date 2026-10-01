import { Prisma } from "@marketpilot/db";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { pageResult } from "../common/request-query.dto";
import { DatabaseService } from "../database.module";
import { NotificationQueryDto, UpdateNotificationDto } from "./notification.dto";

const publicSelect = {
  id: true,
  category: true,
  severity: true,
  title: true,
  body: true,
  actionPath: true,
  readAt: true,
  archivedAt: true,
  createdAt: true,
  triggerId: true,
} as const;
@Injectable()
export class NotificationsService {
  constructor(private readonly db: DatabaseService) {}
  async list(userId: string, query: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      archivedAt: query.status === "archived" ? { not: null } : null,
      ...(query.status === "unread" ? { readAt: null } : {}),
      ...(query.status === "read" ? { readAt: { not: null } } : {}),
      ...(query.category ? { category: query.category } : {}),
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
      this.db.notification.findMany({
        where,
        select: publicSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.notification.count({ where }),
    ]);
    const triggerIds = items.flatMap((item) => (item.triggerId ? [item.triggerId] : []));
    const triggers = triggerIds.length
      ? await this.db.alertTrigger.findMany({
          where: { userId, id: { in: triggerIds } },
          select: {
            id: true,
            alertId: true,
            assetId: true,
            condition: true,
            threshold: true,
            value: true,
            unit: true,
            interval: true,
            observationAt: true,
            source: true,
            providerSymbol: true,
            priceKind: true,
          },
        })
      : [];
    const byId = new Map(triggers.map((trigger) => [trigger.id, trigger]));
    return pageResult(
      items.map(({ triggerId, ...item }) => {
        const trigger = triggerId ? byId.get(triggerId) : undefined;
        return {
          ...item,
          marketAlert: trigger
            ? {
                alertId: trigger.alertId,
                assetId: trigger.assetId,
                condition: trigger.condition,
                threshold: trigger.threshold.toString(),
                value: trigger.value.toString(),
                unit: trigger.unit,
                interval: trigger.interval,
                observationAt: trigger.observationAt,
                source: trigger.source,
                providerSymbol: trigger.providerSymbol,
                priceKind: trigger.priceKind,
              }
            : null,
        };
      }),
      total,
      query,
    );
  }
  async summary(userId: string) {
    const [unread, inbox, archived] = await Promise.all([
      this.db.notification.count({ where: { userId, archivedAt: null, readAt: null } }),
      this.db.notification.count({ where: { userId, archivedAt: null } }),
      this.db.notification.count({ where: { userId, archivedAt: { not: null } } }),
    ]);
    return { unread, inbox, archived };
  }
  async update(userId: string, id: string, input: UpdateNotificationDto) {
    if (input.read === undefined && input.archived === undefined)
      throw new BadRequestException("Choose a notification action.");
    const data: Prisma.NotificationUpdateManyMutationInput = {
      ...(input.read === undefined ? {} : { readAt: input.read ? new Date() : null }),
      ...(input.archived === undefined ? {} : { archivedAt: input.archived ? new Date() : null }),
    };
    const result = await this.db.notification.updateMany({ where: { id, userId }, data });
    if (!result.count) throw new NotFoundException("Notification not found.");
    return { success: true };
  }
  async readAll(userId: string) {
    const result = await this.db.notification.updateMany({
      where: { userId, archivedAt: null, readAt: null, createdAt: { lte: new Date() } },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
