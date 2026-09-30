import { Reflector } from "@nestjs/core";

import { ROLES_KEY } from "../common/auth";
import { AdminQueryDto } from "../common/request-query.dto";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

describe("Administration boundaries", () => {
  it("requires ADMIN across the whole controller", () => {
    expect(new Reflector().get(ROLES_KEY, AdminController)).toEqual(["ADMIN"]);
  });
  it("lists safe user fields with bounded pagination and role filters", async () => {
    const db = { user: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    const query = new AdminQueryDto();
    query.page = 2;
    query.pageSize = 10;
    query.role = "ADMIN";
    query.search = "Sadra";
    const result = await new AdminService(db as never, {} as never).users(query);
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({ roles: { some: { role: { name: "ADMIN" } } } }),
      }),
    );
    expect(db.user.findMany.mock.calls[0][0].select).not.toHaveProperty("passwordHash");
    expect(result).toMatchObject({ total: 0, page: 2, pageSize: 10 });
  });
  it("never selects API key hashes", async () => {
    const db = { apiKey: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    await new AdminService(db as never, {} as never).keys(new AdminQueryDto());
    expect(db.apiKey.findMany.mock.calls[0][0].select).not.toHaveProperty("secretHash");
  });
});
