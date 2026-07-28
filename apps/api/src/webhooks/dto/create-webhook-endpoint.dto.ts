import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CreateWebhookEndpointDto {
  @IsUrl({ require_tld: false, require_protocol: true })
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Subscribed event types (e.g. "entitlement.granted"). Empty array means "all events". */
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  eventTypes!: string[];

  @IsOptional()
  @IsUUID()
  environmentId?: string;
}
