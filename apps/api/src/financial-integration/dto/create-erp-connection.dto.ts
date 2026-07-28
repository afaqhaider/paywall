import { IsString, IsUrl, MinLength } from "class-validator";

export class CreateErpConnectionDto {
  @IsUrl({ require_tld: false })
  baseUrl!: string;

  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  apiKey!: string;
}
