import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
export class ResearchDto {
  @ApiProperty({ description: "Client-generated UUID; reused requests never start another provider run." })
  @IsUUID()
  requestId!: string;
  @ApiProperty() @IsUUID() conversationId!: string;
  @ApiProperty({ maxLength: 2000 }) @IsString() @MinLength(1) @MaxLength(2000) input!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() watchlistId?: string;
}
export class ProposalDecisionDto {
  @ApiProperty() @IsUUID() runId!: string;
  @ApiProperty({ enum: ["confirm", "cancel"] }) @IsIn(["confirm", "cancel"]) decision!: "confirm" | "cancel";
}
export class EntryAlertDto {
  @ApiProperty({ minimum: 0.00000001, maximum: 1000000 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.00000001)
  @Max(1000000)
  distance!: number;
  @ApiProperty({ enum: ["pips", "quote"] }) @IsIn(["pips", "quote"]) unit!: "pips" | "quote";
  @ApiProperty({ enum: [true], description: "Explicit confirmation of the displayed near-entry rule" })
  @IsBoolean()
  @Equals(true)
  @Transform(({ obj }: { obj: { confirm?: unknown } }) => obj.confirm)
  confirm!: boolean;
}
