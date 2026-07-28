export type ProductStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type ProductVisibility = "PRIVATE" | "INTERNAL" | "PUBLIC";
export type PlanBillingType = "RECURRING" | "ONE_TIME";
export type PlanStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type BillingInterval =
  "DAY" | "WEEK" | "MONTH" | "QUARTER" | "SEMIANNUAL" | "YEAR" | "LIFETIME" | "CUSTOM";
export type PriceStatus = "ACTIVE" | "ARCHIVED" | "SCHEDULED";

export interface Product {
  id: string;
  organizationId: string;
  applicationId: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  visibility: ProductVisibility;
  metadata: Record<string, unknown> | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Plan {
  id: string;
  productId: string;
  name: string;
  code: string;
  description: string | null;
  billingType: PlanBillingType;
  trialEligible: boolean;
  trialDays: number | null;
  seatLimit: number | null;
  status: PlanStatus;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Price {
  id: string;
  planId: string;
  currency: string;
  amountMinor: number;
  interval: BillingInterval;
  intervalCount: number;
  taxInclusive: boolean;
  countryCode: string | null;
  providerRef: string | null;
  effectiveAt: string;
  expiresAt: string | null;
  status: PriceStatus;
  createdAt: string;
  updatedAt: string;
}

export const PRODUCT_STATUSES: ProductStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];
export const PRODUCT_VISIBILITIES: ProductVisibility[] = ["PRIVATE", "INTERNAL", "PUBLIC"];
export const PLAN_BILLING_TYPES: PlanBillingType[] = ["RECURRING", "ONE_TIME"];
export const PLAN_STATUSES: PlanStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];
export const BILLING_INTERVALS: BillingInterval[] = [
  "DAY",
  "WEEK",
  "MONTH",
  "QUARTER",
  "SEMIANNUAL",
  "YEAR",
  "LIFETIME",
  "CUSTOM",
];
export const PRICE_STATUSES: PriceStatus[] = ["ACTIVE", "ARCHIVED", "SCHEDULED"];
