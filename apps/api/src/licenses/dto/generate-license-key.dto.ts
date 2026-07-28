import { IsDateString, IsInt, IsOptional, Min } from "class-validator";

export class GenerateLicenseKeyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  activationLimit?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
