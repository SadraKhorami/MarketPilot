import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";
import { PageQueryDto } from "../common/request-query.dto";
export class AlertsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: "Exact market symbol, for example XAU-USD." })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9.-]{2,40}$/)
  assetId?: string;

  @ApiPropertyOptional({ default: "all", enum: ["all", "active", "paused"] })
  @IsOptional()
  @IsIn(["all", "active", "paused"])
  status: "all" | "active" | "paused" = "all";
}
