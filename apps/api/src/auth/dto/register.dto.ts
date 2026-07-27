import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { PASSWORD_POLICY_MESSAGE } from "../../common/utils/password.util";

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(12)
  @Matches(STRONG_PASSWORD_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
