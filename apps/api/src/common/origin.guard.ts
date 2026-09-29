import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

const STATE_CHANGING_METHODS = new Set(["POST", "PATCH", "DELETE"]);

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;
    if (!STATE_CHANGING_METHODS.has(request.method) || origin === undefined) return true;

    const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000,http://localhost:3001")
      .split(",")
      .map((value) => value.trim());
    const sameOrigin = `${request.protocol}://${request.get("host")}`;

    if (typeof origin === "string" && (allowedOrigins.includes(origin) || origin === sameOrigin)) return true;

    throw new ForbiddenException({
      error: { code: "ORIGIN_NOT_ALLOWED", message: "This request origin is not allowed." },
    });
  }
}
