import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CredentialsDto {
  @ApiProperty({ example: "analyst@example.com" })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 72, description: "Maximum 72 UTF-8 bytes" })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}

export class RegisterDto extends CredentialsDto {
  @ApiProperty({ minLength: 12, maxLength: 72 })
  @MinLength(12)
  declare password: string;

  @ApiProperty({ required: false, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
