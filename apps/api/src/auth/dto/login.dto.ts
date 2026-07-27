import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(255)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}
