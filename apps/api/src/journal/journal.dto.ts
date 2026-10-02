import { Equals, IsBoolean, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { PageQueryDto } from "../common/request-query.dto";
export class JournalQueryDto extends PageQueryDto {
  @IsOptional() @IsIn(["planned", "open", "closed", "cancelled", "expired"]) status?: string;
  @IsOptional() @IsString() @MaxLength(32) symbol?: string;
}
export class SaveJournalDto {
  @IsUUID() runId!: string;
  @IsBoolean() @Equals(true) confirm!: boolean;
}
export class JournalUpdateDto {
  @IsOptional() @IsIn(["open", "closed", "cancelled"]) status?: "open" | "closed" | "cancelled";
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsNumber() @Min(0.00000001) @Max(1e12) entryPrice?: number;
  @IsOptional() @IsNumber() @Min(0.00000001) @Max(1e12) exitPrice?: number;
  @IsOptional() @IsNumber() @Min(0.00000001) @Max(1e12) quantity?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1e12) fees?: number;
}
