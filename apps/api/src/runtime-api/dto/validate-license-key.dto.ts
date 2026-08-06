import { IsString, MaxLength, MinLength } from "class-validator";

/** Body for `POST /v1/licenses/validate`. */
export class ValidateLicenseKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  licenseKey!: string;
}
