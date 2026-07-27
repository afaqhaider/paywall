import { IsString, Matches, MinLength } from "class-validator";
import { PASSWORD_POLICY_MESSAGE } from "../../common/utils/password.util";

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  @Matches(STRONG_PASSWORD_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  newPassword!: string;
}
