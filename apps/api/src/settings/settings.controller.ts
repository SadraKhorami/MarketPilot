import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { ApiSessionAuth, ApiStandardResponses } from "../common/api-documentation";

import { type AuthenticatedUser, CurrentUser } from "../common/auth";
import { DatabaseService } from "../database.module";

class NotificationPreferencesDto {
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsBoolean() inAppEnabled?: boolean;
}

@ApiTags("Settings")
@ApiSessionAuth()
@ApiStandardResponses()
@Controller("settings")
export class SettingsController {
  constructor(private readonly db: DatabaseService) {}

  @Get() async get(@CurrentUser() user: AuthenticatedUser) {
    const [profile, channels] = await Promise.all([
      this.db.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { id: true, email: true, name: true, createdAt: true },
      }),
      this.db.notificationChannel.findMany({
        where: { userId: user.id },
        select: { id: true, provider: true, active: true, preferences: true, createdAt: true, updatedAt: true },
      }),
    ]);
    return { data: { profile, channels } };
  }

  @Patch("notifications") async updateNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: NotificationPreferencesDto,
  ) {
    const current = await this.db.notificationChannel.findUnique({
      where: { userId_provider: { userId: user.id, provider: "WEB" } },
    });
    const previous =
      current?.preferences && typeof current.preferences === "object" && !Array.isArray(current.preferences)
        ? current.preferences
        : {};
    const preferences = { ...previous, ...body };
    const channel = await this.db.notificationChannel.upsert({
      where: { userId_provider: { userId: user.id, provider: "WEB" } },
      create: { userId: user.id, provider: "WEB", active: true, verifiedAt: new Date(), preferences },
      update: { preferences },
      select: { id: true, provider: true, active: true, preferences: true, updatedAt: true },
    });
    return { data: channel };
  }
}
