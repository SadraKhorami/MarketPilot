import { createHash } from "node:crypto";
import { NotFoundException } from "@nestjs/common";

import { ApiKeysService } from "./api-keys.service";

describe("ApiKeysService", () => {
  it("returns a generated secret once and stores only its hash", async () => {
    let record: { prefix: string; secretHash: string; userId: string; name: string } | undefined;
    const db = {
      activityLog: { create: jest.fn().mockResolvedValue(undefined) },
      apiKey: {
        create: jest.fn(async ({ data }) => {
          record = data;
          return { ...data, id: "key-1", createdAt: new Date(), scopes: data.scopes };
        }),
      },
    };
    const store = {
      ...db,
      $transaction: jest.fn(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db)),
    };
    const service = new ApiKeysService(
      store as never,
      { security: jest.fn(), registered: jest.fn() } as never,
      { capacity: jest.fn() } as never,
    );
    const result = await service.create("user-1", " Data job ", ["watchlists:read"]);
    expect(result.secret).toMatch(/^mp_live_[0-9a-f]{16}_[0-9a-f]{64}$/);
    expect(record?.prefix).toBe(result.secret.slice(0, 24));
    expect(record?.secretHash).toBe(createHash("sha256").update(result.secret).digest("hex"));
    expect(record?.secretHash).not.toBe(result.secret);
    expect(result.name).toBe("Data job");
  });

  it("lists keys without secret material and scopes revocation by owner", async () => {
    const db = {
      activityLog: { create: jest.fn().mockResolvedValue(undefined) },
      apiKey: {
        findMany: jest.fn().mockResolvedValue([{ id: "key-1", prefix: "mp_live_abc12345" }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const store = {
      ...db,
      $transaction: jest.fn(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db)),
    };
    const service = new ApiKeysService(
      store as never,
      { security: jest.fn(), registered: jest.fn() } as never,
      { capacity: jest.fn() } as never,
    );
    const rows = await service.list("user-1");
    expect(rows[0]).not.toHaveProperty("secretHash");
    await service.revoke("user-1", "key-1");
    expect(db.apiKey.updateMany).toHaveBeenCalledWith({
      where: { id: "key-1", userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("does not revoke keys belonging to a different user", async () => {
    const db = {
      activityLog: { create: jest.fn().mockResolvedValue(undefined) },
      apiKey: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const store = {
      ...db,
      $transaction: jest.fn(async (operation: (tx: typeof db) => Promise<unknown>) => operation(db)),
    };
    const service = new ApiKeysService(
      store as never,
      { security: jest.fn(), registered: jest.fn() } as never,
      { capacity: jest.fn() } as never,
    );
    await expect(service.revoke("user-2", "key-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
