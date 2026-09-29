import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";

import { ApiScopes, type AuthenticatedUser, CurrentUser } from "../common/auth";
import { CreateAlertDto, UpdateAlertDto } from "./alerts.dto";
import { AlertsService } from "./alerts.service";

@ApiTags("Alerts")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("alerts")
export class AlertsController {
  constructor(private readonly service: AlertsService) {}
  @Get() @ApiScopes("alerts:read") async list(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.list(user.id) };
  }
  @Post() async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateAlertDto) {
    return { data: await this.service.create(user.id, body) };
  }
  @Patch(":id") async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() body: UpdateAlertDto,
  ) {
    return { data: await this.service.update(user.id, id, body) };
  }
  @Delete(":id") async remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { data: await this.service.remove(user.id, id) };
  }
}
