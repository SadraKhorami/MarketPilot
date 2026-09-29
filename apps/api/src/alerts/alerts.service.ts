import { Prisma } from "@marketpilot/db";
import { Injectable, NotFoundException } from "@nestjs/common";

import { ActivityService } from "../common/activity.service";
import { DatabaseService } from "../database.module";
import { CreateAlertDto, UpdateAlertDto } from "./alerts.dto";

@Injectable()
export class AlertsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityService,
  ) {}

  list(userId: string) {
    return this.db.alert.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  async create(userId: string, input: CreateAlertDto) {
    const alert = await this.db.alert.create({
      data: {
        userId,
        name: input.name.trim(),
        assetId: input.assetId.toUpperCase(),
        condition: input.condition,
        threshold: new Prisma.Decimal(input.threshold),
        enabled: input.enabled ?? true,
        cooldownMinutes: input.cooldownMinutes ?? 60,
      },
    });
    await this.activity.record(userId, "ALERT_CREATED", `Created alert ${alert.name}`, {
      alertId: alert.id,
      assetId: alert.assetId,
    });
    return alert;
  }

  async update(userId: string, id: string, input: UpdateAlertDto) {
    const data: Prisma.AlertUpdateManyMutationInput = { ...input };
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.assetId !== undefined) data.assetId = input.assetId.toUpperCase();
    if (input.threshold !== undefined) data.threshold = new Prisma.Decimal(input.threshold);
    const result = await this.db.alert.updateMany({ where: { id, userId }, data });
    if (!result.count) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Alert not found." } });
    await this.activity.record(userId, "ALERT_UPDATED", "Updated an alert", { alertId: id });
    return this.db.alert.findUniqueOrThrow({ where: { id } });
  }

  async remove(userId: string, id: string) {
    const result = await this.db.alert.deleteMany({ where: { id, userId } });
    if (!result.count) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Alert not found." } });
    await this.activity.record(userId, "ALERT_DELETED", "Deleted an alert", { alertId: id });
    return { success: true };
  }
}
