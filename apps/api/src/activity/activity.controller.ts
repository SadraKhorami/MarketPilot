import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";

import { type AuthenticatedUser, CurrentUser } from "../common/auth";
import { DatabaseService } from "../database.module";

class ActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

@ApiTags("Activity")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("activity")
export class ActivityController {
  constructor(private readonly db: DatabaseService) {}
  @Get() async list(@CurrentUser() user: AuthenticatedUser, @Query() query: ActivityQueryDto) {
    return {
      data: await this.db.activityLog.findMany({
        where: { userId: user.id },
        orderBy: { occurredAt: "desc" },
        take: query.limit,
      }),
    };
  }
}
