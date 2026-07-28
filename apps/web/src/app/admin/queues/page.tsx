"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import { isAvailable, type AdminMonitoringOverview } from "../../../lib/admin-monitoring-types";

const PANELS: { key: keyof AdminMonitoringOverview; label: string }[] = [
  { key: "apiRequests", label: "API Requests" },
  { key: "webhookDeliveries", label: "Webhook Deliveries" },
  { key: "erpSynchronizations", label: "ERP Synchronizations" },
  { key: "paymentProcessing", label: "Payment Processing" },
  { key: "queueLength", label: "Queue Length" },
  { key: "workerStatus", label: "Worker Status" },
  { key: "databaseStatus", label: "Database Status" },
  { key: "cacheStatus", label: "Cache Status" },
  { key: "storageUsage", label: "Storage Usage" },
  { key: "backgroundJobs", label: "Background Jobs" },
];

export default function AdminMonitoringPage() {
  const { authedFetch } = useAuth();
  const [overview, setOverview] = useState<AdminMonitoringOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<AdminMonitoringOverview>("/admin/monitoring/overview");
      setOverview(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load monitoring overview.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">System Monitoring</h1>
      <p className="mt-1 text-sm text-slate-500">
        Live platform health - request volume, queues, workers and background jobs.
      </p>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : !overview ? (
        <p className="mt-8 text-sm text-slate-500">No monitoring data.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PANELS.map(({ key, label }) => {
            const value = overview[key];
            return (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  {value === undefined ? (
                    <p className="text-sm italic text-slate-400">Not available</p>
                  ) : isAvailable(value) ? (
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                      {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                    </pre>
                  ) : (
                    <p className="text-sm italic text-slate-400">
                      Not available
                      {typeof value === "object" && value && "reason" in value
                        ? ` — ${String((value as { reason?: string }).reason)}`
                        : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
