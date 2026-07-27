import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

const SUPPORTED_LANGUAGES = ["en", "es", "fr", "de", "pt", "ur", "ar", "hi", "zh", "ja"];

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  displayName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
