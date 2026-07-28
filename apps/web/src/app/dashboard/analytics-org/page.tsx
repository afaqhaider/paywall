"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Card, CardContent, CardHeader, CardTitle, Label, Select } from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import {
  ANALYTICS_PERIODS,
  type AnalyticsPeriod,
  type DeveloperAnalyticsBundle,
} from "../../../lib/platform-analytics-types";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-24 shrink-0 text-slate-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right font-medium text-slate-700">{value}</span>
    </div>
  );
}

function OrgAnalyticsContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [period, setPeriod] = useState<AnalyticsPeriod>("MONTHLY");
  const [bundle, setBundle] = useState<DeveloperAnalyticsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) {
      setBundle(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<DeveloperAnalyticsBundle>(
        `/organizations/${selectedOrgId}/analytics?period=${period}`,
      );
      setBundle(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load organization analytics.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const trendMax = Math.max(
    1,
    ...(bundle?.usageTrends.map((p) => Math.max(p.apiRequests, p.webhookDeliveries)) ?? []),
  );

  return (
    <>
      <DashboardNav>
        <OrgSwitcher
          organizations={organizations}
          selectedOrgId={selectedOrgId}
          onSelect={selectOrg}
        />
      </DashboardNav>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Developer Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Organization-wide metrics for{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span> - distinct
          from the per-application view under Analytics.
        </p>

        <div className="mt-4 max-w-xs">
          <Label htmlFor="period">Period</Label>
          <Select
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
          >
            {ANALYTICS_PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : !bundle ? (
          <p className="mt-8 text-sm text-slate-500">
            Select an organization to view its analytics.
          </p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Revenue (minor units)" value={bundle.revenue.value} />
              <StatTile label="Customers" value={bundle.customers.total} />
              <StatTile
                label="Active subscriptions"
                value={`${bundle.subscriptions.active} / ${bundle.subscriptions.total}`}
              />
              <StatTile label="New subscriptions" value={bundle.subscriptions.new} />
              <StatTile label="Renewals" value={bundle.renewals.count} />
              <StatTile
                label="Trial conversion"
                value={`${(bundle.trials.conversionRate * 100).toFixed(1)}%`}
              />
              <StatTile
                label="Refund rate"
                value={`${(bundle.refunds.refundRate * 100).toFixed(1)}%`}
              />
              <StatTile label="API requests" value={bundle.apiRequests.count} />
              <StatTile
                label="Active licenses"
                value={`${bundle.licenses.active} / ${bundle.licenses.total}`}
              />
              <StatTile
                label="License usage rate"
                value={`${(bundle.licenses.usageRate * 100).toFixed(1)}%`}
              />
              <StatTile label="Devices" value={bundle.devices.total} />
              <StatTile label="Daily active users" value={bundle.devices.dailyActive} />
              <StatTile label="Monthly active users" value={bundle.devices.monthlyActive} />
              <StatTile label="Webhook deliveries" value={bundle.webhookDeliveries.total} />
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Webhook delivery status</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4 text-sm text-slate-600">
                {Object.entries(bundle.webhookDeliveries.byStatus).map(([status, count]) => (
                  <span key={status}>
                    {status}: <span className="font-medium text-slate-900">{count}</span>
                  </span>
                ))}
                {Object.keys(bundle.webhookDeliveries.byStatus).length === 0 ? (
                  <span className="text-slate-500">No webhook deliveries in this period.</span>
                ) : null}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Usage trend (API requests / day)</CardTitle>
              </CardHeader>
              <CardContent>
                {bundle.usageTrends.length === 0 ? (
                  <p className="text-sm text-slate-500">No usage recorded in this period.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {bundle.usageTrends.map((point) => (
                      <BarRow
                        key={point.date}
                        label={point.date}
                        value={point.apiRequests}
                        max={trendMax}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function OrgAnalyticsPage() {
  return (
    <ProtectedRoute>
      <OrgAnalyticsContent />
    </ProtectedRoute>
  );
}
