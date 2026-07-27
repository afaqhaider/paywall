import {
  IsEnum,
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";
import { ApplicationVisibility } from "@prisma/client";

export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  bundleIdentifier?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  packageName?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  webIdentifier?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsEnum(ApplicationVisibility)
  visibility?: ApplicationVisibility;
}
