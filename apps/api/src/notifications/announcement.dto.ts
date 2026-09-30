import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { PageQueryDto } from "../common/request-query.dto";

export const ANNOUNCEMENT_PATHS = [
  "/dashboard/default",
  "/dashboard/markets",
  "/dashboard/watchlist",
  "/dashboard/analytics",
  "/dashboard/news-and-sentiment",
  "/dashboard/alerts",
  "/dashboard/api/documentation",
  "/dashboard/settings/security",
  "/dashboard/notifications",
] as const;
export class AnnouncementQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ["DRAFT", "PUBLISHED", "CANCELLED"] })
  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "CANCELLED"])
  status?: "DRAFT" | "PUBLISHED" | "CANCELLED";
}
export class AnnouncementAudienceDto {
  @ApiProperty({ enum: ["ALL", "USERS", "ADMINS"] })
  @IsIn(["ALL", "USERS", "ADMINS"])
  audience!: "ALL" | "USERS" | "ADMINS";
}
export class AnnouncementInputDto {
  @ApiProperty({ maxLength: 120 }) @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(120) title!: string;
  @ApiProperty({ maxLength: 2000 }) @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(2000) body!: string;
  @ApiProperty({ enum: ["ALL", "USERS", "ADMINS"] }) @IsIn(["ALL", "USERS", "ADMINS"]) audience!:
    | "ALL"
    | "USERS"
    | "ADMINS";
  @ApiProperty({ enum: ["INFO", "WARNING", "CRITICAL"] }) @IsIn(["INFO", "WARNING", "CRITICAL"]) severity!:
    | "INFO"
    | "WARNING"
    | "CRITICAL";
  @ApiPropertyOptional({ enum: ANNOUNCEMENT_PATHS, nullable: true })
  @IsOptional()
  @IsIn(ANNOUNCEMENT_PATHS)
  actionPath?: (typeof ANNOUNCEMENT_PATHS)[number] | null;
}

export class AnnouncementVersionDto {
  @ApiProperty({ description: "The updatedAt value of the reviewed draft" }) @IsISO8601() expectedUpdatedAt!: string;
}
export class UpdateAnnouncementDto extends AnnouncementInputDto {
  @ApiProperty({ description: "The updatedAt value of the draft being edited" })
  @IsISO8601()
  expectedUpdatedAt!: string;
}
