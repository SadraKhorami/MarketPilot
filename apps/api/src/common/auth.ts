import type { RoleName } from "@marketpilot/db";
import { createParamDecorator, type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Request } from "express";

export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const ROLES_KEY = "roles";
export const Roles = (...roles: RoleName[]) => SetMetadata(ROLES_KEY, roles);
export const API_SCOPES_KEY = "apiScopes";
export const ApiScopes = (...scopes: string[]) => SetMetadata(API_SCOPES_KEY, scopes);

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  roles: RoleName[];
  sessionId?: string;
  apiKeyId?: string;
  apiKeyScopes?: string[];
}

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => (context.switchToHttp().getRequest() as AuthenticatedRequest).user,
);
