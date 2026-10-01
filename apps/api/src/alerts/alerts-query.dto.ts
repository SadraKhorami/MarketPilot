import { IsIn, IsOptional } from "class-validator";
import { PageQueryDto } from "../common/request-query.dto";
export class AlertsQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(["all", "active", "paused"])
  status: "all" | "active" | "paused" = "all";
}
