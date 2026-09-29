import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

import { API_SCOPES_KEY, type AuthenticatedRequest } from "./auth";

@Injectable()
export class ApiScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.apiKeyId) return true;
    const required = this.reflector.getAllAndOverride<string[]>(API_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required?.length && required.every((scope) => request.user.apiKeyScopes?.includes(scope))) return true;
    throw new ForbiddenException({
      error: { code: "API_SCOPE_REQUIRED", message: "This API key does not have permission for this operation." },
    });
  }
}
