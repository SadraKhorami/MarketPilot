import { HttpException } from "@nestjs/common";

import { RateLimitGuard } from "./rate-limit.guard";

describe("RateLimitGuard", () => {
  const requestContext = (path: string, method = "GET", user?: { id: string; apiKeyId?: string }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ path, method, ip: "127.0.0.1", user }),
        getResponse: () => ({ setHeader: jest.fn() }),
      }),
    }) as never;

  function createGuard() {
    const redis = { ensureConnected: jest.fn().mockRejectedValue(new Error("Redis unavailable")) };
    return new RateLimitGuard(redis as never);
  }

  it("keeps session checks and logout out of the credential rate limit", async () => {
    const guard = createGuard();

    for (let index = 0; index < 12; index++) {
      await expect(guard.canActivate(requestContext("/api/v1/auth/me"))).resolves.toBe(true);
    }
    await expect(guard.canActivate(requestContext("/api/v1/auth/logout", "POST"))).resolves.toBe(true);
  });

  it("continues to limit repeated login attempts", async () => {
    const guard = createGuard();

    for (let index = 0; index < 10; index++) {
      await expect(guard.canActivate(requestContext("/api/v1/auth/login", "POST", undefined))).resolves.toBe(true);
    }
    await expect(guard.canActivate(requestContext("/api/v1/auth/login", "POST", undefined))).rejects.toBeInstanceOf(
      HttpException,
    );
  });
  it("isolates API key buckets from browser traffic and always permits logout", async () => {
    const guard = createGuard();
    for (let index = 0; index < 120; index++)
      await guard.canActivate(requestContext("/api/v1/news", "GET", { id: "owner", apiKeyId: "one" }));
    await expect(
      guard.canActivate(requestContext("/api/v1/news", "GET", { id: "owner", apiKeyId: "one" })),
    ).rejects.toBeInstanceOf(HttpException);
    await expect(
      guard.canActivate(requestContext("/api/v1/news", "GET", { id: "owner", apiKeyId: "two" })),
    ).resolves.toBe(true);
    await expect(guard.canActivate(requestContext("/api/v1/auth/me", "GET", { id: "owner" }))).resolves.toBe(true);
    await expect(
      guard.canActivate(requestContext("/api/v1/auth/logout", "POST", { id: "owner", apiKeyId: "one" })),
    ).resolves.toBe(true);
  });
});
