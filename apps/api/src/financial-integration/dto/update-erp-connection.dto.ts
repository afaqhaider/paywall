import { IsOptional, IsString, IsUrl, MinLength } from "class-validator";

export class UpdateErpConnectionDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  companyId?: string;
}
