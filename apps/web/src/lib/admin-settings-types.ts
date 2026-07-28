export interface PlatformSetting {
  key: string;
  value: unknown;
  updatedAt?: string;
}

export const KNOWN_SETTING_KEYS = [
  "maintenance_mode",
  "branding",
  "supported_currencies",
  "supported_languages",
  "subscription_defaults",
  "default_quotas",
] as const;

export interface FeatureFlag {
  key: string;
  name?: string;
  description?: string | null;
  enabled: boolean;
  rolloutPercentage?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface MessageTemplate {
  type: string;
  key: string;
  subject?: string | null;
  body: string;
  updatedAt?: string;
}
