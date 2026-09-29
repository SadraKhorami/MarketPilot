import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { ActivityService } from "../common/activity.service";
import { DatabaseService } from "../database.module";

@Injectable()
export class WatchlistsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityService,
  ) {}

  list(userId: string) {
    return this.db.watchlist.findMany({
      where: { userId },
      include: { items: { orderBy: { position: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(userId: string, name: string) {
    const watchlist = await this.db.watchlist.create({ data: { userId, name: name.trim() } });
    await this.activity.record(userId, "WATCHLIST_CREATED", `Created watchlist ${watchlist.name}`);
    return watchlist;
  }

  async update(userId: string, id: string, name: string) {
    const result = await this.db.watchlist.updateMany({ where: { id, userId }, data: { name: name.trim() } });
    if (!result.count) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Watchlist not found." } });
    return this.db.watchlist.findUniqueOrThrow({ where: { id } });
  }

  async remove(userId: string, id: string) {
    const count = await this.db.watchlist.count({ where: { userId } });
    if (count <= 1)
      throw new ConflictException({ error: { code: "LAST_WATCHLIST", message: "Keep at least one watchlist." } });
    const deleted = await this.db.watchlist.deleteMany({ where: { id, userId } });
    if (!deleted.count) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Watchlist not found." } });
    await this.activity.record(userId, "WATCHLIST_DELETED", "Deleted a watchlist");
    return { success: true };
  }

  async addItem(userId: string, watchlistId: string, assetId: string) {
    await this.requireOwner(userId, watchlistId);
    const normalized = assetId.trim().toUpperCase();
    const count = await this.db.watchlistItem.count({ where: { watchlistId } });
    try {
      const item = await this.db.watchlistItem.create({ data: { watchlistId, assetId: normalized, position: count } });
      await this.db.watchlist.update({ where: { id: watchlistId }, data: { updatedAt: new Date() } });
      await this.activity.record(userId, "WATCHLIST_ITEM_ADDED", `Added ${normalized} to a watchlist`, {
        assetId: normalized,
      });
      return item;
    } catch (error) {
      if (isUniqueError(error))
        throw new ConflictException({
          error: { code: "ASSET_ALREADY_WATCHED", message: "This asset is already in the watchlist." },
        });
      throw error;
    }
  }

  async removeItem(userId: string, watchlistId: string, itemId: string) {
    await this.requireOwner(userId, watchlistId);
    const result = await this.db.watchlistItem.deleteMany({ where: { id: itemId, watchlistId } });
    if (!result.count)
      throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Watchlist item not found." } });
    await this.db.watchlist.update({ where: { id: watchlistId }, data: { updatedAt: new Date() } });
    await this.activity.record(userId, "WATCHLIST_ITEM_REMOVED", "Removed an asset from a watchlist");
    return { success: true };
  }

  async reorder(userId: string, watchlistId: string, assetIds: string[]) {
    await this.requireOwner(userId, watchlistId);
    const items = await this.db.watchlistItem.findMany({ where: { watchlistId }, select: { id: true, assetId: true } });
    if (
      assetIds.length !== items.length ||
      new Set(assetIds).size !== items.length ||
      assetIds.some((assetId) => !items.some((item) => item.assetId === assetId))
    ) {
      throw new ConflictException({
        error: { code: "INVALID_ORDER", message: "Order must include every watchlist asset exactly once." },
      });
    }
    await this.db.$transaction(
      assetIds.map((assetId, position) =>
        this.db.watchlistItem.updateMany({ where: { watchlistId, assetId }, data: { position } }),
      ),
    );
    return this.db.watchlistItem.findMany({ where: { watchlistId }, orderBy: { position: "asc" } });
  }

  private async requireOwner(userId: string, id: string) {
    const watchlist = await this.db.watchlist.findFirst({ where: { id, userId }, select: { id: true } });
    if (!watchlist) throw new NotFoundException({ error: { code: "NOT_FOUND", message: "Watchlist not found." } });
  }
}

function isUniqueError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
