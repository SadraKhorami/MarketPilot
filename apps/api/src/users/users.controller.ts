import { RoleName } from "@marketpilot/db";
import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { ActivityService } from "../common/activity.service";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";
import { type AuthenticatedUser, CurrentUser, Roles } from "../common/auth";
import { DatabaseService } from "../database.module";

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
}

@ApiTags("Users")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("users")
export class UsersController {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityService,
  ) {}

  @Get("me") me(@CurrentUser() user: AuthenticatedUser) {
    return { data: user };
  }

  @Patch("me") async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateProfileDto) {
    const updated = await this.db.user.update({
      where: { id: user.id },
      data: { name: body.name?.trim() || null },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    await this.activity.record(user.id, "PROFILE_UPDATED", "Updated profile");
    return { data: updated };
  }

  @Get()
  @Roles(RoleName.ADMIN)
  async list() {
    return {
      data: await this.db.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          createdAt: true,
          roles: { select: { role: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
}
