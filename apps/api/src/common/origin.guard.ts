import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { SESSION_COOKIE } from "../auth/auth.constants";
import { webOrigins } from "./runtime-config";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;
    if (SAFE_METHODS.has(request.method)) return true;
    const production = process.env.NODE_ENV === "production";
    if (origin === undefined) {
      // Bearer requests cannot inherit cookies. Browser session writes must prove their origin.
      if (!production || !request.cookies?.[SESSION_COOKIE] || request.headers.authorization) return true;
    } else {
      const sameOrigin = `${request.protocol}://${request.get("host")}`;
      if (typeof origin === "string" && (webOrigins().includes(origin) || (!production && origin === sameOrigin)))
        return true;
    }

    throw new ForbiddenException({
      error: { code: "ORIGIN_NOT_ALLOWED", message: "This request origin is not allowed." },
    });
  }
}
