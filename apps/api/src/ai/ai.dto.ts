import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
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
