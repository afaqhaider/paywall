import type { EntitlementDefinition } from "./features-types";

export type EntitlementGrantSource = "SUBSCRIPTION" | "TRIAL" | "MANUAL" | "PROMOTIONAL";
export type EntitlementGrantStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

export interface EntitlementGrant {
  id: string;
  entitlementDefinitionId: string;
  entitlementDefinition?: EntitlementDefinition;
  organizationId: string;
  applicationId: string;
  subscriptionId: string | null;
  source: EntitlementGrantSource;
  status: EntitlementGrantStatus;
  boolValue: boolean | null;
  numberValue: number | null;
  textValue: string | null;
  isUnlimited: boolean;
  validFrom: string;
  validUntil: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown> | null;
  version: number;
  createdAt: string;
  updatedAt: string;
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

export const ENTITLEMENT_GRANT_SOURCES: EntitlementGrantSource[] = [
  "SUBSCRIPTION",
  "TRIAL",
  "MANUAL",
  "PROMOTIONAL",
];
