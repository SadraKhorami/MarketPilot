import { NotFoundException } from "@nestjs/common";

import { AlertsService } from "./alerts.service";

describe("AlertsService", () => {
  const activity = { record: jest.fn().mockResolvedValue(undefined) };

  it("creates an alert scoped to its owner", async () => {
    const db = { alert: { create: jest.fn().mockResolvedValue({ id: "a1", assetId: "BTCUSDT", threshold: "64000" }) } };
    const service = new AlertsService(db as never, activity as never);
    const result = await service.create("user-1", {
      name: " BTC level ",
      assetId: "btcusdt",
      condition: "PRICE_ABOVE" as never,
      threshold: 64000,
    });
    expect(db.alert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", name: "BTC level", assetId: "BTCUSDT" }),
    });
    expect(result.id).toBe("a1");
  });

  it("updates and deletes only owned alert records", async () => {
    const db = {
      alert: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "a1", enabled: false }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new AlertsService(db as never, activity as never);
    await service.update("user-1", "a1", { enabled: false });
    expect(db.alert.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", userId: "user-1" },
      data: { enabled: false },
    });
    await expect(service.remove("user-1", "a1")).resolves.toEqual({ success: true });
    expect(db.alert.deleteMany).toHaveBeenCalledWith({ where: { id: "a1", userId: "user-1" } });
  });

  it("returns not found when another owner changes an alert", async () => {
    const db = { alert: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const service = new AlertsService(db as never, activity as never);
    await expect(service.update("user-2", "a1", { enabled: false })).rejects.toBeInstanceOf(NotFoundException);
  });
});
