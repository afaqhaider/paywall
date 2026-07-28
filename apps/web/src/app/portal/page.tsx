"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@paywall/ui";
import { ProtectedRoute } from "../../components/protected-route";
import { PortalNav } from "../../components/portal-nav";
import { CustomerSwitcher } from "../../components/customer-switcher";
import { useAuth } from "../../lib/auth-context";
import { useCustomer } from "../../lib/customer-context";
import { ApiError } from "../../lib/api-client";
import type { CustomerDashboardSummary } from "../../lib/customer-portal-types";

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <Card className={href ? "h-full transition-shadow hover:shadow-md" : "h-full"}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function PortalDashboardContent() {
  const { user } = useAuth();
  const { customers, selectedCustomerId, selectedCustomer, loading, selectCustomer } =
    useCustomer();
  const { authedFetch } = useAuth();
  const [summary, setSummary] = useState<CustomerDashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedCustomerId) {
      setSummary(null);
      setSummaryLoading(false);
      return;
    }
    setSummaryLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CustomerDashboardSummary>(
        `/customer-portal/customers/${selectedCustomerId}/dashboard`,
      );
      setSummary(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your dashboard.");
    } finally {
      setSummaryLoading(false);
    }
  }, [authedFetch, selectedCustomerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PortalNav>
        <CustomerSwitcher
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelect={selectCustomer}
        />
      </PortalNav>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome, {user?.displayName ?? user?.email}
        </h1>
        {selectedCustomer ? (
          <p className="mt-1 text-sm text-slate-500">
            Viewing <span className="font-medium">{selectedCustomer.applicationName}</span> ·{" "}
            {selectedCustomer.organizationName}
          </p>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading || summaryLoading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : customers.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">
            You don&apos;t have any customer accounts yet. Once you purchase a subscription, it will
            show up here.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Active subscriptions"
              value={summary?.activeSubscriptionCount ?? 0}
              href="/portal/subscriptions"
            />
            <StatCard
              label="Next renewal"
              value={
                summary?.nextRenewalDate
                  ? new Date(summary.nextRenewalDate).toLocaleDateString()
                  : "—"
              }
              href="/portal/subscriptions"
            />
            <StatCard label="Licenses" value={summary?.licenseCount ?? 0} href="/portal/licenses" />
            <StatCard label="Devices" value={summary?.deviceCount ?? 0} href="/portal/devices" />
            <StatCard
              label="Unread notifications"
              value={summary?.unreadNotificationCount ?? 0}
              href="/portal/notifications"
            />
          </div>
        )}
      </main>
    </>
  );
}

export default function PortalDashboardPage() {
  return (
    <ProtectedRoute>
      <PortalDashboardContent />
    </ProtectedRoute>
  );
}
