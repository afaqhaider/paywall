import { IsObject, IsOptional, IsUrl } from "class-validator";

export class UpsertApplicationEnvironmentDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  baseUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  apiUrl?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;
}
