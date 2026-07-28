"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Card, CardContent, CardHeader, CardTitle } from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { PortalNav } from "../../../components/portal-nav";
import { CustomerSwitcher } from "../../../components/customer-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useCustomer } from "../../../lib/customer-context";
import { ApiError } from "../../../lib/api-client";
import type { CustomerUsageSnapshot } from "../../../lib/customer-portal-types";

function UsageBar({ snapshot }: { snapshot: CustomerUsageSnapshot }) {
  const pct =
    !snapshot.isUnlimited && snapshot.limit
      ? Math.min(100, Math.round((snapshot.used / snapshot.limit) * 100))
      : 0;
  const nearLimit = pct >= 90;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{snapshot.entitlementName ?? snapshot.entitlementKey}</span>
          <span className="text-sm font-normal text-slate-500">
            {snapshot.isUnlimited
              ? `${snapshot.used} used · Unlimited`
              : `${snapshot.used} / ${snapshot.limit ?? "—"}`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {snapshot.isUnlimited ? (
          <div className="h-2 w-full rounded-full bg-emerald-100">
            <div className="h-2 w-full rounded-full bg-emerald-500" />
          </div>
        ) : (
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${nearLimit ? "bg-red-500" : "bg-slate-900"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {!snapshot.isUnlimited && snapshot.remaining !== null ? (
          <p className="mt-2 text-xs text-slate-500">{snapshot.remaining} remaining</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function UsageContent() {
  const { authedFetch } = useAuth();
  const { customers, selectedCustomerId, selectCustomer } = useCustomer();
  const [items, setItems] = useState<CustomerUsageSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedCustomerId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CustomerUsageSnapshot[]>(
        `/customer-portal/customers/${selectedCustomerId}/usage`,
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load usage.");
    } finally {
      setLoading(false);
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
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Usage</h1>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">
            No usage-based entitlements on this account.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((snapshot) => (
              <UsageBar key={snapshot.entitlementKey} snapshot={snapshot} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default function UsagePage() {
  return (
    <ProtectedRoute>
      <UsageContent />
    </ProtectedRoute>
  );
}
