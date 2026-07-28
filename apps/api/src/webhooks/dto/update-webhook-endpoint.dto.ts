import { ArrayUnique, IsArray, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

export class UpdateWebhookEndpointDto {
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  eventTypes?: string[];
}
