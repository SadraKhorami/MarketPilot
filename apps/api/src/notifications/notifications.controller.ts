import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser } from "../common/auth";
import { NotificationQueryDto, UpdateNotificationDto } from "./notification.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get()
  @ApiOperation({ summary: "Your paginated notification inbox" })
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: NotificationQueryDto) {
    return { data: await this.service.list(user.id, query) };
  }
  @Get("summary")
  @ApiOperation({ summary: "Your unread, inbox and archive counts" })
  async summary(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.summary(user.id) };
  }
  @Post("read-all")
  @HttpCode(200)
  @ApiOperation({ summary: "Mark your current non-archived notifications as read" })
  async readAll(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.readAll(user.id) };
  }
  @Patch(":id")
  @ApiOperation({ summary: "Mark a notification read/unread or archive/restore it" })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateNotificationDto,
  ) {
    return { data: await this.service.update(user.id, id, input) };
  }
}
