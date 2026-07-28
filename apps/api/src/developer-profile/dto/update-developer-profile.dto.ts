import { IsEmail, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class UpdateDeveloperProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  websiteUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  githubUrl?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  supportEmail?: string;
}
