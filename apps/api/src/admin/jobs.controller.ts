import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { ActivityService } from "../common/activity.service";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser, Roles } from "../common/auth";
import { PageQueryDto } from "../common/request-query.dto";
import { JobsService } from "./jobs.service";

class JobQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["failed", "waiting", "active", "delayed"])
  status: "failed" | "waiting" | "active" | "delayed" = "failed";
}
@ApiTags("Administration")
@ApiSessionAuth()
@ApiStandardResponses()
@Roles("ADMIN")
@Controller("admin/jobs")
export class JobsController {
  constructor(
    private readonly service: JobsService,
    private readonly activity: ActivityService,
  ) {}
  @Get() async overview() {
    return { data: await this.service.overview() };
  }
  @Get(":queue") async list(@Param("queue") queue: string, @Query() query: JobQueryDto) {
    return { data: await this.service.list(queue, query.status, query) };
  }
  @Post(":queue/:id/retry") async retry(
    @CurrentUser() user: AuthenticatedUser,
    @Param("queue") queue: string,
    @Param("id") id: string,
  ) {
    const data = await this.service.retry(queue, id);
    if (data.retried)
      await this.activity.record(user.id, "BACKGROUND_JOB_RETRIED", "Retried a failed background job", {
        queue,
        jobId: id,
      });
    return { data };
  }
}
