import "reflect-metadata";
import { AIError } from "@marketpilot/ai";
import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { validate } from "class-validator";
import { ApiScopesGuard } from "../common/api-scopes.guard";
import { RolesGuard } from "../common/roles.guard";
import { AiController, aiHttpError } from "./ai.controller";
import { ProposalDecisionDto, ResearchDto } from "./ai.dto";
import { AiBudgetService } from "./ai-budget.service";
import { AiSessionGuard } from "./ai-session.guard";

function context(
  user: object,
  handler: (...args: never[]) => unknown = AiController.prototype.status,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => AiController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}
describe("AI endpoint boundaries", () => {
  it("requires a browser session and never grants existing read keys AI access", () => {
    const guard = new AiSessionGuard();
    expect(guard.canActivate(context({ id: "u", sessionId: "s", roles: ["USER"] }))).toBe(true);
    expect(() => guard.canActivate(context({ id: "u", apiKeyId: "key", roles: ["ADMIN"] }))).toThrow(
      ForbiddenException,
    );
    expect(() => guard.canActivate(context({ id: "u" }))).toThrow(ForbiddenException);
    const scope = new ApiScopesGuard(new Reflector());
    expect(() =>
      scope.canActivate(
        context({ apiKeyId: "key", apiKeyScopes: ["market:read", "alerts:read", "watchlists:read", "news:read"] }),
      ),
    ).toThrow(ForbiddenException);
  });
  it("protects actual AI operational metrics with ADMIN RBAC", () => {
    const roles = new RolesGuard(new Reflector());
    expect(() =>
      roles.canActivate(context({ sessionId: "s", roles: ["USER"] }, AiController.prototype.metrics)),
    ).toThrow(ForbiddenException);
    expect(roles.canActivate(context({ sessionId: "s", roles: ["ADMIN"] }, AiController.prototype.metrics))).toBe(true);
  });
  it("rejects oversized input and tampered confirmation bodies using global whitelist validation", async () => {
    const dto = Object.assign(new ResearchDto(), { requestId: "bad", conversationId: "bad", input: "x".repeat(2001) });
    expect(await validate(dto)).toHaveLength(3);
    const decision = Object.assign(new ProposalDecisionDto(), {
      runId: "00000000-0000-4000-8000-000000000001",
      decision: "confirm",
      threshold: 1,
      userId: "victim",
    });
    const failures = await validate(decision, { whitelist: true, forbidNonWhitelisted: true });
    expect(failures).toHaveLength(2);
  });
  it("maps non-streaming errors to standard safe API responses", () => {
    expect(aiHttpError(new AIError("AI_PROPOSAL_EXPIRED", "Expired")).getStatus()).toBe(409);
    expect(aiHttpError(new Error("private-secret")).getResponse()).toEqual({
      error: { code: "AI_UNAVAILABLE", message: "The research operation could not be completed." },
    });
  });
  it("uses separate Redis admission for per-user/global concurrency and daily reservations, and fails closed", async () => {
    for (const [code, expected] of [
      [1, "AI_BUSY"],
      [2, "AI_RATE_LIMITED"],
      [3, "AI_DAILY_BUDGET"],
      [4, "AI_BUSY"],
    ] as const) {
      const redis = {
        ensureConnected: jest.fn().mockResolvedValue(undefined),
        client: { eval: jest.fn().mockResolvedValue(code) },
      };
      await expect(new AiBudgetService(redis as never).acquire("owner", 0.1)).rejects.toMatchObject({ code: expected });
      expect(redis.client.eval.mock.calls[0]).toContain("marketpilot:ai:active:owner");
    }
    const redis = { ensureConnected: jest.fn().mockRejectedValue(new Error("offline")) };
    await expect(new AiBudgetService(redis as never).acquire("owner", 0.1)).rejects.toMatchObject({
      code: "AI_LIMITS_UNAVAILABLE",
    });
  });
});
