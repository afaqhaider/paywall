import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { FeatureType } from "@prisma/client";

export class CreateFeatureDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(FeatureType)
  type?: FeatureType;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;
}
