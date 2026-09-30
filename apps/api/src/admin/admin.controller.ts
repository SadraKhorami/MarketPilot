import { Controller, Get, Param, ParseUUIDPipe, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { Roles } from "../common/auth";
import { AdminQueryDto, RangeQueryDto } from "../common/request-query.dto";
import { AdminService } from "./admin.service";

@ApiTags("Administration")
@ApiSessionAuth()
@ApiStandardResponses()
@Roles("ADMIN")
@Controller("admin")
export class AdminController {
  constructor(private readonly service: AdminService) {}
  @Get("overview")
  @ApiOperation({ summary: "ADMIN: Account and authenticated request metrics" })
  async overview(@Query() query: RangeQueryDto) {
    return { data: await this.service.overview(query.days) };
  }
  @Get("users")
  @ApiOperation({ summary: "ADMIN: Search accounts without credential material" })
  async users(@Query() query: AdminQueryDto) {
    return { data: await this.service.users(query) };
  }
  @Get("users/:id")
  @ApiOperation({ summary: "ADMIN: Account details and resource counts" })
  async user(@Param("id", ParseUUIDPipe) id: string) {
    return { data: await this.service.user(id) };
  }
  @Get("requests")
  @ApiOperation({ summary: "ADMIN: Recorded authenticated request metadata, including guard rejections" })
  async requests(@Query() query: AdminQueryDto) {
    return { data: await this.service.requests(query) };
  }
  @Get("activity")
  @ApiOperation({ summary: "ADMIN: Account audit events" })
  async activity(@Query() query: AdminQueryDto) {
    return { data: await this.service.activity(query) };
  }
  @Get("api-keys")
  @ApiOperation({ summary: "ADMIN: Key inventory and recorded lifetime usage; no secrets" })
  async keys(@Query() query: AdminQueryDto) {
    return { data: await this.service.keys(query) };
  }
  @Get("system")
  @ApiOperation({ summary: "ADMIN: Dependency checks and implemented integration capabilities" })
  async system() {
    return { data: await this.service.system() };
  }
}
