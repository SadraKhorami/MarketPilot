import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { type AuthenticatedRequest, ROLES_KEY } from "./auth";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (roles.some((role) => user?.roles.includes(role as AuthenticatedRequest["user"]["roles"][number]))) return true;
    throw new ForbiddenException({
      error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." },
    });
  }
}
