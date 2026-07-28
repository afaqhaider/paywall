import { ReportFormat, ReportType } from "@prisma/client";
import { toCsv } from "./csv.util";
import { generateReportPdf } from "./report-pdf.util";

export interface RenderedReport {
  data: Buffer;
  filename: string;
  mimeType: string;
}

const REPORT_TITLES: Record<ReportType, string> = {
  [ReportType.REVENUE]: "Revenue Report",
  [ReportType.SUBSCRIPTIONS]: "Subscriptions Report",
  [ReportType.CUSTOMERS]: "Customers Report",
  [ReportType.APPLICATIONS]: "Applications Report",
  [ReportType.MARKETPLACE]: "Marketplace Report",
  [ReportType.FINANCIAL_SYNC]: "Financial Sync Report",
  [ReportType.DEVELOPER_ACTIVITY]: "Developer Activity Report",
  [ReportType.API_USAGE]: "API Usage Report",
  [ReportType.LICENSE_USAGE]: "License Usage Report",
  [ReportType.STORAGE]: "Storage Report",
};

function baseFilename(type: ReportType): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${type.toLowerCase()}-report-${timestamp}`;
}

/**
 * Renders the query result rows into the requested `ReportFormat`.
 *
 * EXCEL note: no `.xlsx` generation library (exceljs, xlsx, node-xlsx) and
 * no zip library (archiver, jszip) is a dependency anywhere in this
 * monorepo (checked every package.json). Hand-rolling an OOXML zip without
 * either is out of scope here, and adding a new npm dependency is not safe
 * without being able to run an install in this environment. Until a real
 * xlsx library is added, EXCEL format honestly degrades to the same CSV
 * bytes as the CSV format, served with a `.csv` filename and `text/csv`
 * mimetype - never with an xlsx mimetype, since the bytes would not
 * actually be a valid xlsx file.
 */
export async function renderReport(
  type: ReportType,
  format: ReportFormat,
  rows: Record<string, unknown>[],
): Promise<RenderedReport> {
  const base = baseFilename(type);

  switch (format) {
    case ReportFormat.JSON:
      return {
        data: Buffer.from(JSON.stringify(rows, null, 2)),
        filename: `${base}.json`,
        mimeType: "application/json",
      };
    case ReportFormat.CSV:
      return {
        data: Buffer.from(toCsv(rows)),
        filename: `${base}.csv`,
        mimeType: "text/csv",
      };
    case ReportFormat.EXCEL:
      // See doc comment above - degrades to CSV content until a real xlsx
      // library is added as a dependency.
      return {
        data: Buffer.from(toCsv(rows)),
        filename: `${base}.csv`,
        mimeType: "text/csv",
      };
    case ReportFormat.PDF:
      return {
        data: await generateReportPdf(REPORT_TITLES[type], rows),
        filename: `${base}.pdf`,
        mimeType: "application/pdf",
      };
    default: {
      const exhaustiveCheck: never = format;
      throw new Error(`Unsupported report format: ${String(exhaustiveCheck)}`);
    }
  }
}
