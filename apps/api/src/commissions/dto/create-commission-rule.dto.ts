import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateCommissionRuleDto {
  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  flatFeeMinor?: number;
}
