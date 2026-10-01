import { IsBoolean, IsIn, IsOptional, IsUUID } from "class-validator";
import { PageQueryDto } from "../common/request-query.dto";
export class CheckoutDto {
  @IsUUID() requestId!: string;
}
export class CancellationDto {
  @IsBoolean() cancelAtPeriodEnd!: boolean;
}
export class PaymentsQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(["pending", "paid", "failed", "expired", "void", "all"]) status = "all";
}
