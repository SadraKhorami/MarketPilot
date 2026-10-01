import { createHash, timingSafeEqual } from "node:crypto";
import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
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
    const cookie = request.cookies?.[SESSION_COOKIE];
    const sessionToken = typeof cookie === "string" && cookie.length <= 256 ? cookie : undefined;
    // An explicit bearer credential must not inherit a browser session's broader access.
    if (sessionToken && !request.headers.authorization) {
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
        if (!session.lastSeenAt || session.lastSeenAt.getTime() < Date.now() - 60000) {
          void this.db.session
            .updateMany({
              where: {
                id: session.id,
                OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 60000) } }],
              },
              data: { lastSeenAt: new Date() },
            })
            .catch(() => undefined);
        }
        return true;
      }
    }

    const authorization = request.headers.authorization;
    const apiKey = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
    if (apiKey && apiKey.length <= 256) {
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
        expected.length === supplied.length &&
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
        if (!record.lastUsedAt || record.lastUsedAt.getTime() < Date.now() - 60000) {
          void this.db.apiKey
            .updateMany({
              where: {
                id: record.id,
                OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(Date.now() - 60000) } }],
              },
              data: { lastUsedAt: new Date() },
            })
            .catch(() => undefined);
        }
        return true;
      }
    }

    throw new UnauthorizedException({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
  }
}
