import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, ValidateIf } from "class-validator";
import { PageQueryDto } from "../common/request-query.dto";

export class NotificationQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ["all", "unread", "read", "archived"] })
  @IsOptional()
  @IsIn(["all", "unread", "read", "archived"])
  status: "all" | "unread" | "read" | "archived" = "all";
  @ApiPropertyOptional({ enum: ["SECURITY", "ACCOUNT", "ANNOUNCEMENT"] })
  @IsOptional()
  @IsIn(["SECURITY", "ACCOUNT", "ANNOUNCEMENT"])
  category?: "SECURITY" | "ACCOUNT" | "ANNOUNCEMENT";
}
export class UpdateNotificationDto {
  @ApiPropertyOptional()
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  read?: boolean;
  @ApiPropertyOptional()
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  archived?: boolean;
}
