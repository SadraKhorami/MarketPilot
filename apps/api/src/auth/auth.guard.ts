import { createHash, timingSafeEqual } from "node:crypto";
import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { type AuthenticatedRequest, IS_PUBLIC } from "../common/auth";
import { DatabaseService } from "../database.module";
import { SESSION_COOKIE } from "./auth.constants";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = request.cookies?.[SESSION_COOKIE] as string | undefined;
    if (sessionToken) {
      const session = await this.db.session.findUnique({
        where: { tokenHash: createHash("sha256").update(sessionToken).digest("hex") },
        include: { user: { include: { roles: { include: { role: true } } } } },
      });
      if (session && !session.revokedAt && session.expiresAt > new Date() && session.user.status === "ACTIVE") {
        request.user = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          roles: session.user.roles.map((item) => item.role.name),
          sessionId: session.id,
        };
        void this.db.session
          .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
          .catch(() => undefined);
        return true;
      }
    }

    const authorization = request.headers.authorization;
    const apiKey = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    if (apiKey) {
      const prefix = apiKey.slice(0, 24);
      const record = await this.db.apiKey.findUnique({
        where: { prefix },
        include: { user: { include: { roles: { include: { role: true } } } } },
      });
      const supplied = createHash("sha256").update(apiKey).digest();
      const expected = record ? Buffer.from(record.secretHash, "hex") : Buffer.alloc(32);
      if (
        record &&
        record.revokedAt === null &&
        (!record.expiresAt || record.expiresAt > new Date()) &&
        timingSafeEqual(supplied, expected) &&
        record.user.status === "ACTIVE"
      ) {
        request.user = {
          id: record.user.id,
          email: record.user.email,
          name: record.user.name,
          roles: record.user.roles.map((item) => item.role.name),
          apiKeyId: record.id,
          apiKeyScopes: record.scopes,
        };
        void this.db.apiKey
          .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined);
        return true;
      }
    }

    throw new UnauthorizedException({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
  }
}
