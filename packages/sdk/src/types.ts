/**
 * Response shapes are hand-written from the current API implementation
 * (apps/api/src/payments/public/*, apps/api/src/entitlements/*,
 * apps/api/src/devices/*) rather than generated from a schema - accurate as
 * of this SDK version, but see the README's "External requirements"
 * section: generating these from the OpenAPI/Swagger spec instead is a
 * recommended follow-up so they can't silently drift from the real API.
 */

export interface Price {
  id: string;
  planId: string;
  currency: string;
  unitAmount: number;
  interval: string | null;
  status: string;
}

export interface Plan {
  id: string;
  name: string;
  status: string;
  sortOrder: number;
  prices: Price[];
}

export interface CreateCheckoutIntentInput {
  customerEmail: string;
  planId: string;
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateCheckoutIntentResult {
  id: string;
  expiresAt: string;
}

export interface PaymentProviderSummary {
  id: string;
  type: string;
  displayName: string;
}

export interface CheckoutIntentDetail {
  intent: {
    id: string;
    status: "PENDING" | "COMPLETED" | "EXPIRED";
    customerEmail: string;
    planId: string;
    priceId: string;
    expiresAt: string;
  };
  providers: PaymentProviderSummary[];
}

/**
 * Loosely typed on purpose - this is whatever `CheckoutService.create()`
 * returns (a `CheckoutSession` row plus provider-specific redirect info),
 * which varies by provider. Narrow with your own type if you need
 * provider-specific fields.
 */
export interface CheckoutSession {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface EntitlementCheckResult {
  allowed: boolean;
  numberValue: number | null;
  textValue: string | null;
  isUnlimited: boolean;
}

export interface UsageSnapshot {
  used: number;
  limit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
}

export type LicenseKeyValidationResult =
  | {
      valid: true;
      licenseId: string;
      status: string;
      type: string;
      expiresAt: string | null;
      seatLimit: number | null;
      deviceLimit: number | null;
    }
  | { valid: false; reason: "not_found" | "inactive" | "expired" | "activation_limit_reached" };

export type DevicePlatform = "IOS" | "ANDROID" | "WEB" | "DESKTOP" | "OTHER";

export interface RegisterDeviceInput {
  deviceId: string;
  platform: DevicePlatform;
  userId?: string;
  licenseId?: string;
  appVersion?: string;
  osVersion?: string;
  pushToken?: string;
}

export interface DeviceRegistration {
  id: string;
  applicationId: string;
  organizationId: string;
  deviceId: string;
  platform: DevicePlatform;
  status: string;
  userId: string | null;
  licenseId: string | null;
  lastSeenAt: string;
}
