import { NotFoundException } from "@nestjs/common";

import { WatchlistsService } from "./watchlists.service";

describe("WatchlistsService", () => {
  const activity = { record: jest.fn().mockResolvedValue(undefined) };

  it("scopes list, create, and update operations to the signed-in owner", async () => {
    const db = {
      watchlist: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: "w1", name: "Ideas" }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "w1", name: "Updated" }),
      },
    };
    const service = new WatchlistsService(
      db as never,
      activity as never,
      { capacity: jest.fn(), locked: (_id: string, action: (tx: typeof db) => unknown) => action(db) } as never,
    );
    await service.list("user-1");
    await service.create("user-1", " Ideas ");
    await service.update("user-1", "w1", "Updated");
    expect(db.watchlist.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));
    expect(db.watchlist.create).toHaveBeenCalledWith({ data: { userId: "user-1", name: "Ideas" } });
    expect(db.watchlist.updateMany).toHaveBeenCalledWith({
      where: { id: "w1", userId: "user-1" },
      data: { name: "Updated" },
    });
  });

  it("adds normalized assets only to a watchlist owned by the user", async () => {
    const db = {
      watchlist: { findFirst: jest.fn().mockResolvedValue({ id: "w1" }), update: jest.fn() },
      watchlistItem: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: "i1", assetId: "BTC-USD" }),
      },
    };
    const service = new WatchlistsService(
      db as never,
      activity as never,
      { capacity: jest.fn(), locked: (_id: string, action: (tx: typeof db) => unknown) => action(db) } as never,
    );
    const result = await service.addItem("user-1", "w1", "btc-usd");
    expect(db.watchlistItem.create).toHaveBeenCalledWith({
      data: { watchlistId: "w1", assetId: "BTC-USD", position: 0 },
    });
    expect(result.assetId).toBe("BTC-USD");
  });

  it("does not disclose or mutate another user's watchlist", async () => {
    const db = { watchlist: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new WatchlistsService(
      db as never,
      activity as never,
      { capacity: jest.fn(), locked: (_id: string, action: (tx: typeof db) => unknown) => action(db) } as never,
    );
    await expect(service.addItem("user-2", "w1", "BTC-USD")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("deletes an owned list and prevents deleting the final list", async () => {
    const db = {
      watchlist: { count: jest.fn().mockResolvedValue(2), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new WatchlistsService(
      db as never,
      activity as never,
      { capacity: jest.fn(), locked: (_id: string, action: (tx: typeof db) => unknown) => action(db) } as never,
    );
    await expect(service.remove("user-1", "w1")).resolves.toEqual({ success: true });
    db.watchlist.count.mockResolvedValue(1);
    await expect(service.remove("user-1", "w1")).rejects.toMatchObject({
      response: { error: { code: "LAST_WATCHLIST", message: "Keep at least one watchlist." } },
    });
  });
});
