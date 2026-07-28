"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import {
  REPORT_TYPES,
  reportLabel,
  type AdminReport,
  type ReportType,
} from "../../../lib/admin-reports-types";

function ReportCard({ type }: { type: ReportType }) {
  const { authedFetch } = useAuth();
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<AdminReport>(`/admin/reports/${type}`);
      setReport(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load report.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const scalarEntries = report
    ? Object.entries(report).filter(([k, v]) => k !== "items" && typeof v !== "object")
    : [];
  const rows = report?.items ?? [];
  const firstRow = rows[0];
  const columns = firstRow !== undefined ? Object.keys(firstRow).slice(0, 5) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{reportLabel(type)}</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !report ? (
          <p className="text-sm text-slate-500">No data.</p>
        ) : (
          <>
            {scalarEntries.length > 0 ? (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                {scalarEntries.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-medium text-slate-500">{k}</dt>
                    <dd className="text-slate-900">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {rows.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((c) => (
                        <TableHead key={c}>{c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((c) => (
                          <TableCell key={c} className="text-xs">
                            {typeof row[c] === "object"
                              ? JSON.stringify(row[c])
                              : String(row[c] ?? "—")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
            {scalarEntries.length === 0 && rows.length === 0 ? (
              <p className="text-sm text-slate-500">No data.</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminReportsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        Platform-wide reporting - plain numbers and tables.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {REPORT_TYPES.map((type) => (
          <ReportCard key={type} type={type} />
        ))}
      </div>
    </main>
  );
}
