import { IsString, MaxLength, MinLength } from "class-validator";

export class VerifyTwoFactorLoginDto {
  @IsString()
  challengeToken!: string;

  /** A 6-digit TOTP code or an 11-character recovery code. */
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code!: string;
}
