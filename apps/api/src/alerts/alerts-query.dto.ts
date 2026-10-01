import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { PageQueryDto } from "../common/request-query.dto";
export class AlertsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ default: "all", enum: ["all", "active", "paused"] })
  @IsOptional()
  @IsIn(["all", "active", "paused"])
  status: "all" | "active" | "paused" = "all";
}
