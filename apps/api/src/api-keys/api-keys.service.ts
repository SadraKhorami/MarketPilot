import { createHash, randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";

import { ActivityService } from "../common/activity.service";
import { DatabaseService } from "../database.module";

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityService,
  ) {}

  async list(userId: string) {
    const data = await this.db.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return data;
  }

  async create(userId: string, name: string, scopes: string[] = ["watchlists:read", "alerts:read"]) {
    const token = `mp_live_${randomBytes(8).toString("hex")}_${randomBytes(32).toString("hex")}`;
    const prefix = token.slice(0, 24);
    const apiKey = await this.db.apiKey.create({
      data: { userId, name: name.trim(), prefix, secretHash: createHash("sha256").update(token).digest("hex"), scopes },
    });
    await this.activity.record(userId, "API_KEY_CREATED", `Created API key ${apiKey.name}`, {
      apiKeyId: apiKey.id,
      prefix,
    });
    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
      secret: token,
    };
  }

  async revoke(userId: string, id: string) {
    const result = await this.db.apiKey.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count)
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Active API key not found." } });
    await this.activity.record(userId, "API_KEY_REVOKED", "Revoked an API key", { apiKeyId: id });
    return { success: true };
  }
}
