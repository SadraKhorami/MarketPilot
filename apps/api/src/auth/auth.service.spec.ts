import { RoleName } from "@marketpilot/db";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcrypt";

import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("registers with a password hash, USER role, and hashed session token", async () => {
    let createdUser: { email: string; passwordHash: string; roles: { create: { roleId: string } } } | undefined;
    let createdSession: { tokenHash: string } | undefined;
    const user = { id: "u1", email: "user@example.com", name: null, roles: [{ role: { name: RoleName.USER } }] };
    const db = {
      role: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "role-user" }) },
      $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          user: {
            create: jest.fn(async ({ data }) => {
              createdUser = data;
              return user;
            }),
          },
        }),
      ),
      session: {
        create: jest.fn(async ({ data }) => {
          createdSession = data;
          return { id: "s1" };
        }),
      },
    };
    const activity = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(db as never, activity as never);

    const result = await service.register({ email: " User@Example.com ", password: "a-long-enough-password" });

    expect(createdUser).toBeDefined();
    expect(createdUser?.email).toBe("user@example.com");
    expect(createdUser?.passwordHash).not.toBe("a-long-enough-password");
    expect(await bcrypt.compare("a-long-enough-password", createdUser?.passwordHash ?? "")).toBe(true);
    expect(createdUser?.roles.create.roleId).toBe("role-user");
    expect(result.rawToken).not.toBe(createdSession?.tokenHash);
    expect(createdSession?.tokenHash).toHaveLength(64);
    expect(activity.record).toHaveBeenCalledWith("u1", "USER_REGISTERED", "Account created");
  });

  it("rejects invalid credentials with a generic response", async () => {
    const db = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new AuthService(db as never, { record: jest.fn() } as never);
    await expect(service.login({ email: "unknown@example.com", password: "wrong-password" })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects passwords that bcrypt would truncate", async () => {
    const service = new AuthService({} as never, {} as never);
    await expect(service.register({ email: "user@example.com", password: "é".repeat(37) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
