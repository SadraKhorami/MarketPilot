import type { Prisma } from "@marketpilot/db";
import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database.module";

@Injectable()
export class ActivityService {
  constructor(private readonly db: DatabaseService) {}

  async record(userId: string, eventType: string, description: string, metadata: Prisma.InputJsonValue = {}) {
    return this.db.activityLog.create({ data: { userId, eventType, description, metadata } });
  }
}
