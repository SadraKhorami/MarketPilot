import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/auth";
import { EntitlementsService } from "./entitlements.service";
@Injectable()
export class ApiQuotaGuard implements CanActivate {
  constructor(private readonly entitlements: EntitlementsService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.apiKeyId) await this.entitlements.consume(request.user.id, "api");
    return true;
  }
}
