import { NotFoundException } from "@nestjs/common";

import { AlertsService } from "./alerts.service";

describe("AlertsService", () => {
  const activity = { record: jest.fn().mockResolvedValue(undefined) };

  it("creates an alert scoped to its owner", async () => {
    const db = {
      alert: { create: jest.fn().mockResolvedValue({ id: "a1", assetId: "BTC-USDT", threshold: "64000" }) },
    };
    const catalog = { list: jest.fn().mockResolvedValue({ instruments: [{ symbol: "BTC-USDT", available: true }] }) };
    const service = new AlertsService(db as never, activity as never, catalog as never);
    const result = await service.create("user-1", {
      name: " BTC level ",
      assetId: "btc-usdt",
      condition: "PRICE_ABOVE" as never,
      threshold: 64000,
    });
    expect(db.alert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", name: "BTC level", assetId: "BTC-USDT" }),
    });
    expect(result.id).toBe("a1");
  });

  it("updates and deletes only owned alert records", async () => {
    const updatedAt = new Date("2026-10-01T00:00:00Z");
    const db = {
      alert: {
        findFirst: jest.fn().mockResolvedValue({ id: "a1", userId: "user-1", updatedAt }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "a1", enabled: false }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new AlertsService(db as never, activity as never);
    await service.update("user-1", "a1", { enabled: false });
    expect(db.alert.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", userId: "user-1", updatedAt },
      data: { enabled: false },
    });
    await expect(service.remove("user-1", "a1")).resolves.toEqual({ success: true });
    expect(db.alert.deleteMany).toHaveBeenCalledWith({ where: { id: "a1", userId: "user-1" } });
  });

  it("returns not found when another owner changes an alert", async () => {
    const db = { alert: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() } };
    const service = new AlertsService(db as never, activity as never);
    await expect(service.update("user-2", "a1", { enabled: false })).rejects.toBeInstanceOf(NotFoundException);
  });
});
