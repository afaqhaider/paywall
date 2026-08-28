import { IsString, MinLength } from "class-validator";

export class ValidateLicenseKeyDto {
  @IsString()
  @MinLength(1)
  key!: string;
}
