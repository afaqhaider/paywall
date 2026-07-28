/** White-label settings types - mirrors `WhiteLabelController`
 * (`organizations/:organizationId/white-label`). `GET` returns `null` when
 * the organization has never configured white-labeling - callers should
 * treat that as "use platform defaults", not an error. */

export interface WhiteLabelConfig {
  id: string;
  organizationId: string;
  logoUrl: string | null;
  brandName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customDomain: string | null;
  emailFromName: string | null;
  emailTemplates: Record<string, { subject?: string; bodyTemplate?: string }> | null;
  marketplaceBranding: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateWhiteLabelInput {
  logoUrl?: string;
  brandName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customDomain?: string;
  emailFromName?: string;
  emailTemplates?: Record<string, { subject?: string; bodyTemplate?: string }>;
  marketplaceBranding?: Record<string, unknown>;
}
