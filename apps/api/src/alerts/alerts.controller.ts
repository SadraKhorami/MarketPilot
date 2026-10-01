import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ApiReadAuth, ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";

import { ApiScopes, type AuthenticatedUser, CurrentUser } from "../common/auth";
import { PageQueryDto } from "../common/request-query.dto";
import { CreateAlertDto, UpdateAlertDto } from "./alerts.dto";
import { AlertsService } from "./alerts.service";
import { AlertsQueryDto } from "./alerts-query.dto";

@ApiTags("Alerts")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("alerts")
export class AlertsController {
  constructor(private readonly service: AlertsService) {}
  @Get() @ApiScopes("alerts:read") @ApiReadAuth() async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AlertsQueryDto,
  ) {
    return { data: await this.service.list(user.id, query) };
  }
  @Get("summary") @ApiScopes("alerts:read") @ApiReadAuth() async summary(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.summary(user.id) };
  }
  @Get(":id/history") @ApiScopes("alerts:read") @ApiReadAuth() async history(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: PageQueryDto,
  ) {
    return { data: await this.service.history(user.id, id, query) };
  }
  @Get(":id") @ApiScopes("alerts:read") @ApiReadAuth() async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return { data: await this.service.detail(user.id, id) };
  }
  @Post() async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAlertDto) {
    return { data: await this.service.create(user.id, body) };
  }
  @Patch(":id") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateAlertDto,
  ) {
    return { data: await this.service.update(user.id, id, body) };
  }
  @Delete(":id") async remove(@CurrentUser() user: AuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return { data: await this.service.remove(user.id, id) };
  }
}
