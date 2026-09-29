import { AlertCondition } from "@marketpilot/db";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateAlertDto {
  @ApiProperty({ example: "BTC breaks resistance" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: "BTC-USD" })
  @IsString()
  @Matches(/^[a-zA-Z0-9:_-]{2,32}$/)
  assetId!: string;

  @ApiProperty({ enum: AlertCondition })
  @IsEnum(AlertCondition)
  condition!: AlertCondition;

  @ApiProperty({ example: 65000 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  threshold!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: 60, minimum: 0, maximum: 10080 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10080)
  cooldownMinutes?: number;
}

export class UpdateAlertDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9:_-]{2,32}$/) assetId?: string;
  @ApiPropertyOptional({ enum: AlertCondition }) @IsOptional() @IsEnum(AlertCondition) condition?: AlertCondition;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ allowNaN: false, allowInfinity: false }) threshold?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(10080) cooldownMinutes?: number;
}
