export type CustomerType = "INDIVIDUAL" | "ORGANIZATION" | "EXTERNAL";

export interface Customer {
  id: string;
  organizationId: string;
  applicationId: string | null;
  userId: string | null;
  type: CustomerType;
  displayName: string | null;
  email: string | null;
  externalIds: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export const CUSTOMER_TYPES: CustomerType[] = ["INDIVIDUAL", "ORGANIZATION", "EXTERNAL"];
