import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) search?: string;
}
export class RangeQueryDto {
  @ApiPropertyOptional({ default: 7, maximum: 90 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) days =
    7;
}
export class UsageQueryDto extends RangeQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() keyId?: string;
}
export class AdminQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ default: 7 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) days = 7;
  @ApiPropertyOptional({ enum: ["SESSION", "API_KEY"] }) @IsOptional() @IsIn(["SESSION", "API_KEY"]) authType?:
    | "SESSION"
    | "API_KEY";
  @ApiPropertyOptional({ enum: ["ACTIVE", "DISABLED", "REVOKED"] })
  @IsOptional()
  @IsIn(["ACTIVE", "DISABLED", "REVOKED"])
  status?: "ACTIVE" | "DISABLED" | "REVOKED";
  @ApiPropertyOptional({ enum: ["ADMIN", "USER"] }) @IsOptional() @IsIn(["ADMIN", "USER"]) role?: "ADMIN" | "USER";
  @ApiPropertyOptional({ enum: ["success", "error"] }) @IsOptional() @IsIn(["success", "error"]) outcome?:
    | "success"
    | "error";
}
export function sinceDays(days: number) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - days + 1);
  return since;
}
export function pageResult<T>(items: T[], total: number, query: PageQueryDto) {
  return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.ceil(total / query.pageSize) };
}
