import type { Response } from "express";

import type { AuthenticatedRequest } from "./auth";
import { RequestUsageMiddleware } from "./request-usage.middleware";

describe("Authenticated request logging", () => {
  const db = { apiUsage: { create: jest.fn().mockResolvedValue({}) } };
  beforeEach(() => jest.clearAllMocks());
  function execute(user?: { id: string; apiKeyId?: string }, path = "/api/v1/news", statusCode = 403) {
    let finished: (() => void) | undefined;
    const response = {
      statusCode,
      once: jest.fn((_event: string, callback: () => void) => {
        finished = callback;
      }),
    };
    const request = { user, path, method: "GET", route: { path: "/api/v1/news" }, requestId: "request-123" };
    new RequestUsageMiddleware(db as never).use(
      request as unknown as AuthenticatedRequest,
      response as unknown as Response,
      jest.fn(),
    );
    finished?.();
  }
  it("captures denied API key requests after guards finish", () => {
    execute({ id: "owner", apiKeyId: "key" });
    expect(db.apiUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "owner",
        apiKeyId: "key",
        authType: "API_KEY",
        statusCode: 403,
        requestId: "request-123",
      }),
    });
  });
  it("labels browser traffic and never records anonymous requests or health", () => {
    execute({ id: "owner" }, undefined, 200);
    expect(db.apiUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ authType: "SESSION", apiKeyId: null }),
    });
    db.apiUsage.create.mockClear();
    execute();
    execute({ id: "owner" }, "/api/v1/health/ready");
    expect(db.apiUsage.create).not.toHaveBeenCalled();
  });
});
