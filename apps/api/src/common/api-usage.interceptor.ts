import { randomUUID } from "node:crypto";
import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import type { Request } from "express";
import { catchError, finalize, type Observable, throwError } from "rxjs";

import { DatabaseService } from "../database.module";
import type { AuthenticatedRequest } from "./auth";

@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly db: DatabaseService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request & { requestId?: string }>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();
    const startedAt = Date.now();
    let failedStatus: number | undefined;
    return next.handle().pipe(
      catchError((error: unknown) => {
        failedStatus =
          typeof error === "object" && error !== null && "getStatus" in error && typeof error.getStatus === "function"
            ? error.getStatus()
            : 500;
        return throwError(() => error);
      }),
      finalize(() => {
        if (!request.user || request.path.startsWith("/api/v1/health")) return;
        void this.db.apiUsage
          .create({
            data: {
              userId: request.user.id,
              apiKeyId: request.user.apiKeyId ?? null,
              requestId: request.requestId ?? randomUUID(),
              route: request.route?.path ?? request.path,
              method: request.method,
              statusCode: failedStatus ?? response.statusCode,
              latencyMs: Date.now() - startedAt,
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}
