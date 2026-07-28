/** Platform-wide admin search - mirrors `PlatformSearchController`
 * (`GET /admin/search`). */

export const PLATFORM_SEARCH_TYPES = [
  "organizations",
  "applications",
  "customers",
  "subscriptions",
  "invoices",
  "licenses",
  "apiKeys",
  "reviews",
] as const;
export type PlatformSearchType = (typeof PLATFORM_SEARCH_TYPES)[number];

export interface SearchResultRow {
  id: string;
  type:
    | "organization"
    | "application"
    | "customer"
    | "subscription"
    | "invoice"
    | "license"
    | "apiKey"
    | "review";
  label: string;
  organizationId: string | null;
}

export interface PlatformSearchResponse {
  query: string;
  results: {
    organizations: SearchResultRow[];
    applications: SearchResultRow[];
    customers: SearchResultRow[];
    subscriptions: SearchResultRow[];
    invoices: SearchResultRow[];
    licenses: SearchResultRow[];
    apiKeys: SearchResultRow[];
    reviews: SearchResultRow[];
  };
}
