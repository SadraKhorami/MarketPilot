import { ForbiddenException } from "@nestjs/common";

import { OriginGuard } from "./origin.guard";

describe("OriginGuard", () => {
  const context = (method: string, origin?: string) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        protocol: "http",
        headers: origin ? { origin } : {},
        get: (name: string) => (name === "host" ? "localhost:4000" : undefined),
      }),
    }),
  });

  it("accepts configured and same-origin writes", () => {
    const guard = new OriginGuard();
    expect(guard.canActivate(context("POST", "http://localhost:3000") as never)).toBe(true);
    expect(guard.canActivate(context("DELETE", "http://localhost:4000") as never)).toBe(true);
  });

  it("rejects cross-origin writes and allows originless API clients", () => {
    const guard = new OriginGuard();
    expect(() => guard.canActivate(context("PATCH", "https://attacker.example") as never)).toThrow(ForbiddenException);
    expect(guard.canActivate(context("POST") as never)).toBe(true);
  });

  it("does not restrict safe methods", () => {
    expect(new OriginGuard().canActivate(context("GET", "https://attacker.example") as never)).toBe(true);
  });
});
