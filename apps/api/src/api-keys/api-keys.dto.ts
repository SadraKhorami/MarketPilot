import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

import { API_SCOPES as allowedScopes } from "./api-catalog";

export class CreateApiKeyDto {
  @ApiProperty({ example: "Research script" })
  @IsString()
  @Matches(/\S/, { message: "Key name must contain visible characters." })
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ type: [String], enum: allowedScopes })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(allowedScopes, { each: true })
  scopes?: string[];
}
