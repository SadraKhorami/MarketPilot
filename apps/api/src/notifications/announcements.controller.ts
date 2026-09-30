import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser, Roles } from "../common/auth";
import {
  AnnouncementAudienceDto,
  AnnouncementInputDto,
  AnnouncementQueryDto,
  AnnouncementVersionDto,
  UpdateAnnouncementDto,
} from "./announcement.dto";
import { AnnouncementsService } from "./announcements.service";

@ApiTags("Administrative notifications")
@ApiSessionAuth()
@ApiStandardResponses()
@Roles("ADMIN")
@Controller("admin/notifications")
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}
  @Get()
  @ApiOperation({ summary: "ADMIN: Search announcements and aggregate delivery/read counts" })
  async list(@Query() query: AnnouncementQueryDto) {
    return { data: await this.service.list(query) };
  }
  @Get("summary")
  @ApiOperation({ summary: "ADMIN: Announcement metrics" })
  async summary() {
    return { data: await this.service.summary() };
  }
  @Get("audience")
  @ApiOperation({ summary: "ADMIN: Preview eligible accounts and preference exclusions" })
  async audience(@Query() query: AnnouncementAudienceDto) {
    return { data: await this.service.audiencePreview(query.audience) };
  }
  @Post()
  @ApiOperation({ summary: "ADMIN: Save an announcement draft; does not send" })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() input: AnnouncementInputDto) {
    return { data: await this.service.create(user.id, input) };
  }
  @Patch(":id")
  @ApiOperation({ summary: "ADMIN: Edit an unpublished draft" })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateAnnouncementDto,
  ) {
    return { data: await this.service.update(user.id, id, input) };
  }
  @Post(":id/publish")
  @HttpCode(200)
  @ApiOperation({ summary: "ADMIN: Publish once to eligible active accounts, honoring optional notice preferences" })
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AnnouncementVersionDto,
  ) {
    return { data: await this.service.publish(user.id, id, input.expectedUpdatedAt) };
  }
  @Post(":id/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "ADMIN: Cancel a draft; published messages cannot be withdrawn" })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: AnnouncementVersionDto,
  ) {
    return { data: await this.service.cancel(user.id, id, input.expectedUpdatedAt) };
  }
}
