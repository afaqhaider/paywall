"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@paywall/ui";
import { useAuth } from "../../lib/auth-context";
import { ApiError } from "../../lib/api-client";
import type { AdminReport } from "../../lib/admin-reports-types";
import { isAvailable, type AdminMonitoringOverview } from "../../lib/admin-monitoring-types";

/** Report payloads are loose - probe a handful of common field names rather
 * than assuming one exact shape. */
function extractCount(report: AdminReport | null): number | string {
  if (!report) return "—";
  for (const key of ["total", "count", "totalCount", "total_count"]) {
    const value = report[key];
    if (typeof value === "number") return value;
  }
  if (Array.isArray(report.items)) return report.items.length;
  return "—";
}

const OVERVIEW_REPORTS: { key: string; label: string; href: string }[] = [
  { key: "organizations", label: "Organizations", href: "/admin/organizations" },
  { key: "applications", label: "Applications", href: "/admin/applications" },
  { key: "subscriptions", label: "Subscriptions", href: "/admin/subscriptions" },
  { key: "customer-growth", label: "Customers", href: "/admin/customers" },
];

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const inner = (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function AdminOverviewPage() {
  const { authedFetch } = useAuth();
  const [reports, setReports] = useState<Record<string, AdminReport | null>>({});
  const [monitoring, setMonitoring] = useState<AdminMonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [reportResults, monitoringResult] = await Promise.all([
          Promise.allSettled(
            OVERVIEW_REPORTS.map((r) => authedFetch<AdminReport>(`/admin/reports/${r.key}`)),
          ),
          Promise.allSettled([authedFetch<AdminMonitoringOverview>("/admin/monitoring/overview")]),
        ]);
        if (cancelled) return;
        const reportMap: Record<string, AdminReport | null> = {};
        OVERVIEW_REPORTS.forEach((r, i) => {
          const res = reportResults[i];
          reportMap[r.key] = res && res.status === "fulfilled" ? res.value : null;
        });
        setReports(reportMap);
        const monitoringRes = monitoringResult[0];
        setMonitoring(
          monitoringRes && monitoringRes.status === "fulfilled" ? monitoringRes.value : null,
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load overview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [authedFetch]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Operations Center</h1>
      <p className="mt-1 text-sm text-slate-500">
        Platform-wide overview across all organizations and applications.
      </p>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OVERVIEW_REPORTS.map((r) => (
              <StatCard
                key={r.key}
                label={r.label}
                value={extractCount(reports[r.key] ?? null)}
                href={r.href}
              />
            ))}
          </div>

          <h2 className="mt-10 text-lg font-semibold text-slate-900">System Monitoring</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {monitoring ? (
              (
                [
                  ["API Requests", monitoring.apiRequests],
                  ["Webhook Deliveries", monitoring.webhookDeliveries],
                  ["ERP Synchronizations", monitoring.erpSynchronizations],
                  ["Payment Processing", monitoring.paymentProcessing],
                  ["Queue Length", monitoring.queueLength],
                  ["Worker Status", monitoring.workerStatus],
                ] as const
              ).map(([label, value]) => (
                <Card key={label}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isAvailable(value) ? (
                      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                        {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                      </pre>
                    ) : (
                      <p className="text-sm italic text-slate-400">Not available</p>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-sm text-slate-500">Monitoring data not available.</p>
            )}
          </div>
          <p className="mt-4 text-sm text-slate-500">
            See{" "}
            <Link href="/admin/queues" className="underline">
              Monitoring
            </Link>{" "}
            for the full system health dashboard.
          </p>
        </>
      )}
    </main>
  );
}
