import { IsString, MaxLength, MinLength } from "class-validator";

/** Accepts either a 6-digit TOTP code or an 11-character recovery code (e.g. "A1B2C-D3E4F"). */
export class DisableTwoFactorDto {
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code!: string;
}
