import type { EntitlementDefinition } from "./features-types";

export type UsageResetPolicy = "NEVER" | "MONTHLY" | "YEARLY" | "LIFETIME";

export interface UsageCounter {
  id: string;
  organizationId: string;
  applicationId: string;
  entitlementDefinitionId: string;
  subscriptionId: string | null;
  value: number;
  periodStart: string;
  periodEnd: string | null;
  lastResetAt: string;
  updatedAt: string;
  createdAt: string;
}

export interface UsageLimit {
  id: string;
  organizationId: string;
  applicationId: string;
  entitlementDefinitionId: string;
  entitlementDefinition?: EntitlementDefinition;
  limitValue: number | null;
  isUnlimited: boolean;
  resetPolicy: UsageResetPolicy;
  updatedAt: string;
  createdAt: string;
  /** Only present on the list() response - paired current counter, if one exists yet. */
  counter?: UsageCounter | null;
}

export const USAGE_RESET_POLICIES: UsageResetPolicy[] = ["NEVER", "MONTHLY", "YEARLY", "LIFETIME"];
