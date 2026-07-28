/** Report payloads are intentionally loose - each report endpoint returns a
 * shape specific to its subject; we render it generically as key/value stats
 * plus an optional `items` table rather than modeling every field. */
export interface AdminReport {
  [key: string]: unknown;
  items?: Array<Record<string, unknown>>;
}

export const REPORT_TYPES = [
  "organizations",
  "applications",
  "revenue",
  "subscriptions",
  "payments",
  "erp-integrations",
  "api-usage",
  "customer-growth",
  "developer-growth",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export function reportLabel(type: ReportType): string {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
