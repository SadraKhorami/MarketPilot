import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ApiReadAuth, ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";

import { ApiScopes, type AuthenticatedUser, CurrentUser } from "../common/auth";
import { AddWatchlistItemDto, CreateWatchlistDto, ReorderWatchlistDto, UpdateWatchlistDto } from "./watchlists.dto";
import { WatchlistsService } from "./watchlists.service";

@ApiTags("Watchlists")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("watchlists")
export class WatchlistsController {
  constructor(private readonly service: WatchlistsService) {}

  @Get() @ApiScopes("watchlists:read") @ApiReadAuth() list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.list(user.id).then((data) => ({ data }));
  }
  @Post() async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateWatchlistDto) {
    return { data: await this.service.create(user.id, body.name) };
  }
  @Patch(":id") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: UpdateWatchlistDto,
  ) {
    return { data: await this.service.update(user.id, id, body.name ?? "") };
  }
  @Delete(":id") async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { data: await this.service.remove(user.id, id) };
  }
  @Post(":id/items") async addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: AddWatchlistItemDto,
  ) {
    return { data: await this.service.addItem(user.id, id, body.assetId) };
  }
  @Delete(":id/items/:itemId") async removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
  ) {
    return { data: await this.service.removeItem(user.id, id, itemId) };
  }
  @Patch(":id/items/order") async reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: ReorderWatchlistDto,
  ) {
    return { data: await this.service.reorder(user.id, id, body.assetIds) };
  }
}
