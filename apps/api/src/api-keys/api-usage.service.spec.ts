import { NotFoundException } from "@nestjs/common";

import { UsageQueryDto } from "../common/request-query.dto";
import { ApiUsageService } from "./api-usage.service";

describe("Developer API usage", () => {
  function setup() {
    const db = {
      apiUsage: {
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _avg: { latencyMs: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      apiKey: { count: jest.fn().mockResolvedValue(1), findFirst: jest.fn().mockResolvedValue({ id: "key" }) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    return { db, service: new ApiUsageService(db as never) };
  }
  it("excludes browser requests from every usage query and fills UTC days", async () => {
    const { db, service } = setup();
    const query = new UsageQueryDto();
    query.days = 7;
    const result = await service.summary("owner", query);
    for (const [args] of db.apiUsage.count.mock.calls)
      expect(args.where).toMatchObject({
        userId: "owner",
        authType: "API_KEY",
        occurredAt: { gte: expect.any(Date), lte: expect.any(Date) },
      });
    expect(db.apiUsage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "owner",
          authType: "API_KEY",
          occurredAt: { gte: expect.any(Date), lte: expect.any(Date) },
        }),
      }),
    );
    expect(result.byDay).toHaveLength(7);
    expect(result.byDay.every((row) => row.requests === 0)).toBe(true);
  });
  it("checks ownership before filtering a key and retains revoked-key history", async () => {
    const { db, service } = setup();
    const query = new UsageQueryDto();
    query.keyId = "key";
    await service.summary("owner", query);
    expect(db.apiKey.findFirst).toHaveBeenCalledWith({ where: { id: "key", userId: "owner" }, select: { id: true } });
    expect(db.apiUsage.findMany.mock.calls[0][0].where).toMatchObject({ apiKeyId: "key", authType: "API_KEY" });
    expect(db.apiUsage.findMany.mock.calls[0][0].where).not.toHaveProperty("apiKey.revokedAt");
    db.apiKey.findFirst.mockResolvedValue(null);
    await expect(service.summary("other", query)).rejects.toBeInstanceOf(NotFoundException);
  });
});
