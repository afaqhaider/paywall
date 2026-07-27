import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateApplicationVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  track?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  androidVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  iosVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  webVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  buildNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  minimumSupportedVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  releaseNotes?: string;

  @IsOptional()
  @IsDateString()
  releaseDate?: string;

  @IsOptional()
  @IsBoolean()
  isLatest?: boolean;
}
