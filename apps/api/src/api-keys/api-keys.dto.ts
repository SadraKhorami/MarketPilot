import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

const allowedScopes = ["watchlists:read", "alerts:read"] as const;

export class CreateApiKeyDto {
  @ApiProperty({ example: "Research script" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ type: [String], enum: allowedScopes })
  @IsOptional()
  @IsArray()
  @IsIn(allowedScopes, { each: true })
  scopes?: string[];
}
