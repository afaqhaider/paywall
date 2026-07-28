export type FeatureType = "BOOLEAN" | "NUMERIC_LIMIT" | "TEXT" | "UNLIMITED";

export interface Feature {
  id: string;
  applicationId: string;
  key: string;
  name: string;
  description: string | null;
  type: FeatureType;
  unit: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PlanFeature {
  id: string;
  planId: string;
  featureId: string;
  boolValue: boolean | null;
  numberValue: number | null;
  textValue: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EntitlementDefinition {
  id: string;
  applicationId: string;
  featureId: string | null;
  key: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export const FEATURE_TYPES: FeatureType[] = ["BOOLEAN", "NUMERIC_LIMIT", "TEXT", "UNLIMITED"];
