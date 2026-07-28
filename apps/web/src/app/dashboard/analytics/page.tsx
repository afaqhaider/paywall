"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, Label, Select } from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { ApplicationListResult } from "../../../lib/applications-types";
import type {
  AnalyticsRange,
  ApiRequestPoint,
  AuthRequestPoint,
  BusinessMetrics,
  WebhookStats,
} from "../../../lib/analytics-types";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
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

function AnalyticsContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [range, setRange] = useState<AnalyticsRange>("daily");

  const [apiRequests, setApiRequests] = useState<ApiRequestPoint[]>([]);
  const [authRequests, setAuthRequests] = useState<AuthRequestPoint[]>([]);
  const [webhookStats, setWebhookStats] = useState<WebhookStats | null>(null);
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetrics | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    if (!selectedOrgId) {
      setApplications(null);
      setApplicationId("");
      return;
    }
    try {
      const data = await authedFetch<ApplicationListResult>(
        `/organizations/${selectedOrgId}/applications`,
      );
      setApplications(data);
      setApplicationId((current) =>
        current && data.items.some((a) => a.id === current) ? current : (data.items[0]?.id ?? ""),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applications.");
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const loadMetrics = useCallback(async () => {
    if (!applicationId) {
      setApiRequests([]);
      setAuthRequests([]);
      setWebhookStats(null);
      setBusinessMetrics(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [apiReq, authReq, webhooks, business] = await Promise.all([
        authedFetch<ApiRequestPoint[]>(
          `/applications/${applicationId}/analytics/api-requests?range=${range}`,
        ),
        authedFetch<AuthRequestPoint[]>(
          `/applications/${applicationId}/analytics/auth-requests?range=${range}`,
        ),
        authedFetch<WebhookStats>(`/applications/${applicationId}/analytics/webhook-stats`),
        authedFetch<BusinessMetrics>(`/applications/${applicationId}/analytics/business-metrics`),
      ]);
      setApiRequests(apiReq);
      setAuthRequests(authReq);
      setWebhookStats(webhooks);
      setBusinessMetrics(business);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, applicationId, range]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const apiRequestsMax = Math.max(1, ...apiRequests.map((p) => p.count));
  const authRequestsMax = Math.max(1, ...authRequests.map((p) => p.allowed + p.denied));

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
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Developer-facing metrics for{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>.
        </p>

        <div className="mt-4 flex flex-wrap gap-4">
          <div className="max-w-xs">
            <Label htmlFor="applicationFilter">Application</Label>
            {applications && applications.items.length > 0 ? (
              <Select
                id="applicationFilter"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
              >
                {applications.items.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.displayName ?? app.name}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-sm text-slate-500">No applications yet.</p>
            )}
          </div>
          <div className="max-w-xs">
            <Label htmlFor="rangeFilter">Range</Label>
            <Select
              id="rangeFilter"
              value={range}
              onChange={(e) => setRange(e.target.value as AnalyticsRange)}
            >
              <option value="daily">Daily (last 30 days)</option>
              <option value="monthly">Monthly (last 12 months)</option>
            </Select>
          </div>
        </div>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            {businessMetrics ? (
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Subscriptions" value={businessMetrics.subscriptionCount} />
                <StatTile
                  label="Active subscriptions"
                  value={businessMetrics.activeSubscriptionCount}
                />
                <StatTile label="Active customers" value={businessMetrics.activeCustomerCount} />
                <StatTile label="Active licenses" value={businessMetrics.activeLicenseCount} />
              </div>
            ) : null}

            {webhookStats ? (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Webhook delivery success rate</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-4">
                  <Badge variant={webhookStats.successRatePercent >= 95 ? "success" : "outline"}>
                    {webhookStats.successRatePercent}%
                  </Badge>
                  <span className="text-sm text-slate-500">
                    {webhookStats.successCount} succeeded / {webhookStats.failureCount} failed (out
                    of {webhookStats.totalDeliveries} completed deliveries)
                  </span>
                </CardContent>
              </Card>
            ) : null}

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>API requests</CardTitle>
              </CardHeader>
              <CardContent>
                {apiRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">No API-key-authenticated requests yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {apiRequests.map((point) => (
                      <BarRow
                        key={point.period}
                        label={point.period}
                        value={point.count}
                        max={apiRequestsMax}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Auth requests (allowed vs. denied)</CardTitle>
              </CardHeader>
              <CardContent>
                {authRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">No authorization checks logged yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {authRequests.map((point) => (
                      <BarRow
                        key={point.period}
                        label={point.period}
                        value={point.allowed}
                        max={authRequestsMax}
                      />
                    ))}
                    <p className="mt-2 text-xs text-slate-400">
                      Bar shows allowed requests; denied count is tracked separately per period.
                    </p>
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

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsContent />
    </ProtectedRoute>
  );
}
