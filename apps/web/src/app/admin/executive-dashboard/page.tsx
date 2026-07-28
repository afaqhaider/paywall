"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Label, Select } from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import {
  ANALYTICS_PERIODS,
  type AnalyticsPeriod,
  type ExecutiveDashboard,
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

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default function ExecutiveDashboardPage() {
  const { authedFetch } = useAuth();
  const [period, setPeriod] = useState<AnalyticsPeriod>("MONTHLY");
  const [dashboard, setDashboard] = useState<ExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<ExecutiveDashboard>(
        `/admin/analytics/executive-dashboard?period=${period}`,
      );
      setDashboard(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the executive dashboard.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Executive Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">
        Platform-wide revenue, growth, and health signals for platform admins.
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

      {loading || !dashboard ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile
              label="Platform revenue (minor units)"
              value={dashboard.platformRevenue.value}
            />
            <StatTile label="MRR" value={dashboard.financialHealth.mrr} />
            <StatTile label="ARR" value={dashboard.financialHealth.arr} />
            <StatTile label="Growth rate" value={pct(dashboard.growth.rate)} />
            <StatTile
              label="Organizations"
              value={`${dashboard.organizations.active} active / ${dashboard.organizations.total}`}
            />
            <StatTile label="New organizations" value={dashboard.organizations.new} />
            <StatTile
              label="Applications"
              value={`${dashboard.applications.active} active / ${dashboard.applications.total}`}
            />
            <StatTile label="New applications" value={dashboard.applications.new} />
            <StatTile label="Refund rate" value={pct(dashboard.financialHealth.refundRate)} />
            <StatTile
              label="Chargeback rate"
              value={pct(dashboard.financialHealth.chargebackRate)}
            />
            <StatTile
              label="Financial sync success"
              value={pct(dashboard.financialHealth.financialSyncSuccessRate)}
            />
            <StatTile label="API usage" value={dashboard.apiUsage.count} />
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>ERP adoption</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <Badge variant={dashboard.erpAdoption.adoptionRate >= 0.5 ? "success" : "outline"}>
                {pct(dashboard.erpAdoption.adoptionRate)}
              </Badge>
              <span>
                {dashboard.erpAdoption.connectedOrganizations} of{" "}
                {dashboard.erpAdoption.totalOrganizations} organizations connected to an ERP
              </span>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Infrastructure health</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <Badge
                variant={
                  dashboard.infrastructureHealth.database === "up" ? "success" : "destructive"
                }
              >
                Database: {dashboard.infrastructureHealth.database}
              </Badge>
              <span>Version: {dashboard.infrastructureHealth.version}</span>
              <span>
                Sync queue pending: {dashboard.infrastructureHealth.queueLength.syncQueuePending}
              </span>
              <span>
                Webhook deliveries pending:{" "}
                {dashboard.infrastructureHealth.queueLength.webhookDeliveryPending}
              </span>
            </CardContent>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Top applications by revenue</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {dashboard.topApplications.length === 0 ? (
                  <p className="text-slate-500">No revenue in this period.</p>
                ) : (
                  dashboard.topApplications.map((a) => (
                    <div key={a.applicationId} className="flex items-center justify-between">
                      <span className="truncate">{a.name ?? a.applicationId}</span>
                      <span className="font-medium text-slate-900">{a.revenueMinor}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top developers by revenue</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {dashboard.topDevelopers.length === 0 ? (
                  <p className="text-slate-500">No revenue in this period.</p>
                ) : (
                  dashboard.topDevelopers.map((d) => (
                    <div key={d.organizationId} className="flex items-center justify-between">
                      <span className="truncate">{d.name ?? d.organizationId}</span>
                      <span className="font-medium text-slate-900">{d.revenueMinor}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top customers by revenue</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {dashboard.topCustomers.length === 0 ? (
                  <p className="text-slate-500">No revenue in this period.</p>
                ) : (
                  dashboard.topCustomers.map((c) => (
                    <div key={c.customerId} className="flex items-center justify-between">
                      <span className="truncate">{c.displayName ?? c.email ?? c.customerId}</span>
                      <span className="font-medium text-slate-900">{c.revenueMinor}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
