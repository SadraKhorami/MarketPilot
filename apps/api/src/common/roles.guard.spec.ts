import { ForbiddenException } from "@nestjs/common";

import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  const context = (roles: string[]) => ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: { id: "user-1", roles } }) }),
  });

  it("allows a user with a required role", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) };
    expect(new RolesGuard(reflector as never).canActivate(context(["ADMIN"]) as never)).toBe(true);
  });

  it("rejects a user missing the required role", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) };
    expect(() => new RolesGuard(reflector as never).canActivate(context(["USER"]) as never)).toThrow(
      ForbiddenException,
    );
  });

  it("allows routes with no role requirement", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    expect(new RolesGuard(reflector as never).canActivate(context(["USER"]) as never)).toBe(true);
  });
});
