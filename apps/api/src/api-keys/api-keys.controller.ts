import { Body, Controller, Delete, Get, Header, Param, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser } from "../common/auth";
import { UsageQueryDto } from "../common/request-query.dto";
import { API_CATALOG } from "./api-catalog";
import { CreateApiKeyDto } from "./api-keys.dto";
import { ApiKeysService } from "./api-keys.service";
import { ApiUsageService } from "./api-usage.service";

@ApiTags("API keys")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("api-keys")
export class ApiKeysController {
  constructor(
    private readonly service: ApiKeysService,
    private readonly usageService: ApiUsageService,
  ) {}
  @Get() async list(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.service.list(user.id) };
  }
  @Get("catalog") catalog() {
    return { data: API_CATALOG };
  }
  @Get("usage") async usage(@CurrentUser() user: AuthenticatedUser, @Query() query: UsageQueryDto) {
    return { data: await this.usageService.summary(user.id, query) };
  }
  @Post()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Create a key. The secret is returned once and is never stored in plaintext." })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateApiKeyDto) {
    return { data: await this.service.create(user.id, body.name, body.scopes) };
  }
  @Delete(":id") async revoke(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return { data: await this.service.revoke(user.id, id) };
  }
}
