import { randomUUID } from "node:crypto";
import { Injectable, Logger, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Response } from "express";
import { DatabaseService } from "../database.module";
import type { AuthenticatedRequest } from "./auth";

@Injectable()
export class RequestUsageMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestUsageMiddleware.name);
  constructor(private readonly db: DatabaseService) {}
  use(request: AuthenticatedRequest & { requestId?: string }, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    response.once("finish", () => {
      if (!request.user || request.path.startsWith("/api/v1/health")) return;
      void this.db.apiUsage
        .create({
          data: {
            userId: request.user.id,
            apiKeyId: request.user.apiKeyId ?? null,
            authType: request.user.apiKeyId ? "API_KEY" : "SESSION",
            requestId: request.requestId ?? randomUUID(),
            route: String(request.route?.path ?? request.path).slice(0, 160),
            method: request.method,
            statusCode: response.statusCode,
            latencyMs: Date.now() - startedAt,
          },
        })
        .catch(() => this.logger.warn("Could not persist authenticated request metadata."));
    });
    next();
  }
}
