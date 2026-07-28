/** Platform-admin async report generation - mirrors `ReportsController`
 * (`admin/report-requests`). Deliberately NOT `admin/reports` (Phase 9's
 * `AdminReportsModule`, live dashboard-style reports - see
 * `admin-reports-types.ts`); this is a distinct async CSV/Excel/PDF/JSON
 * export concept. */

export const REPORT_REQUEST_TYPES = [
  "REVENUE",
  "SUBSCRIPTIONS",
  "CUSTOMERS",
  "APPLICATIONS",
  "MARKETPLACE",
  "FINANCIAL_SYNC",
  "DEVELOPER_ACTIVITY",
  "API_USAGE",
  "LICENSE_USAGE",
  "STORAGE",
] as const;
export type ReportRequestType = (typeof REPORT_REQUEST_TYPES)[number];

export const REPORT_REQUEST_FORMATS = ["CSV", "EXCEL", "PDF", "JSON"] as const;
export type ReportRequestFormat = (typeof REPORT_REQUEST_FORMATS)[number];

export const REPORT_REQUEST_STATUSES = ["PENDING", "PROCESSING", "SUCCESS", "FAILED"] as const;
export type ReportRequestStatus = (typeof REPORT_REQUEST_STATUSES)[number];

/** Metadata-only shape (`REPORT_METADATA_SELECT` on the API side) - never
 * includes the raw `resultData` bytes; download those via
 * `GET /admin/report-requests/:id/download`. */
export interface ReportRequestRecord {
  id: string;
  type: ReportRequestType;
  format: ReportRequestFormat;
  status: ReportRequestStatus;
  filters: Record<string, unknown> | null;
  organizationId: string | null;
  requestedById: string;
  filename: string | null;
  mimeType: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateReportRequestInput {
  type: ReportRequestType;
  format: ReportRequestFormat;
  organizationId?: string;
  filters?: Record<string, unknown>;
}

export function reportRequestStatusVariant(
  status: ReportRequestStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "destructive";
    default:
      return "outline";
  }
}
