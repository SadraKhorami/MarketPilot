import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser } from "../common/auth";
import { AdminQueryDto, pageResult, sinceDays } from "../common/request-query.dto";
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
  @Get("history") async history(@CurrentUser() user: AuthenticatedUser, @Query() query: AdminQueryDto) {
    const where = {
      userId: user.id,
      occurredAt: { gte: sinceDays(query.days) },
      ...(query.search
        ? {
            OR: [
              { description: { contains: query.search, mode: "insensitive" as const } },
              { eventType: { contains: query.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.activityLog.findMany({
        where,
        select: { id: true, eventType: true, description: true, occurredAt: true },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.activityLog.count({ where }),
    ]);
    return { data: pageResult(items, total, query) };
  }
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
