import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpsertPlanFeatureDto {
  @IsUUID()
  featureId!: string;

  @IsOptional()
  @IsBoolean()
  boolValue?: boolean;

  @IsOptional()
  @IsInt()
  numberValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  textValue?: string;
}
