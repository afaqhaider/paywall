import { IsHexColor, IsObject, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";

/**
 * `emailTemplates` is a per-organization override map keyed by notification
 * template key, e.g. `{ "WELCOME": { "subject": "...", "bodyTemplate": "..." } }`.
 * This module only stores the map - it does NOT render or send anything.
 * Integration point: `apps/api/src/notifications-engine/` owns actual
 * notification rendering/sending and could, in a future change, look up
 * `WhiteLabelConfig.emailTemplates[key]` for an organization before falling
 * back to its own default templates. That wiring is intentionally not done
 * here to avoid touching notifications-engine's files.
 */
export class UpdateWhiteLabelDto {
  @IsOptional()
  @IsUrl({}, { message: "logoUrl must be a valid URL" })
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  brandName?: string;

  @IsOptional()
  @IsHexColor({ message: "primaryColor must be a hex color, e.g. #336699" })
  primaryColor?: string;

  @IsOptional()
  @IsHexColor({ message: "secondaryColor must be a hex color, e.g. #336699" })
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customDomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  emailFromName?: string;

  @IsOptional()
  @IsObject()
  emailTemplates?: Record<string, { subject?: string; bodyTemplate?: string }>;

  @IsOptional()
  @IsObject()
  marketplaceBranding?: Record<string, unknown>;
}
