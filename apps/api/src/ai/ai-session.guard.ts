import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/auth";
@Injectable()
export class AiSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (user?.apiKeyId || !user?.sessionId)
      throw new ForbiddenException({
        error: { code: "AI_SESSION_REQUIRED", message: "AI research requires a signed-in browser session." },
      });
    return true;
  }
}
