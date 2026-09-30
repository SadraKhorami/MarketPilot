import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AdminController } from "../admin/admin.controller";
import { MarketDataController } from "../market-data/market-data.controller";
import { NewsController } from "../news/news.controller";
import { ApiScopesGuard } from "./api-scopes.guard";

const context = (controller: unknown, handler: unknown, user: unknown) =>
  ({
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as never;
describe("Developer read scopes", () => {
  const guard = new ApiScopesGuard(new Reflector());
  it("allows market and news keys only for the corresponding scope", () => {
    expect(
      guard.canActivate(
        context(MarketDataController, MarketDataController.prototype.getMarketData, {
          apiKeyId: "key",
          apiKeyScopes: ["market:read"],
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        context(NewsController, NewsController.prototype.list, { apiKeyId: "key", apiKeyScopes: ["news:read"] }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        context(NewsController, NewsController.prototype.list, { apiKeyId: "key", apiKeyScopes: ["market:read"] }),
      ),
    ).toThrow(ForbiddenException);
  });
  it("blocks keys from administration even when the key owner is an admin", () => {
    expect(() =>
      guard.canActivate(
        context(AdminController, AdminController.prototype.users, {
          apiKeyId: "key",
          roles: ["ADMIN"],
          apiKeyScopes: ["market:read", "news:read", "watchlists:read", "alerts:read"],
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
