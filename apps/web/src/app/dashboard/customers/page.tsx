"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, buttonVariants, Card, CardContent } from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import type { Customer } from "../../../lib/customers-types";

function CustomersListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [items, setItems] = useState<Customer[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) {
      setItems([]);
      setNextCursor(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<Customer>>(
        `/organizations/${selectedOrgId}/customers`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load customers.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!selectedOrgId || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedFetch<CursorResult<Customer>>(
        `/organizations/${selectedOrgId}/customers?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more customers.");
    } finally {
      setLoadingMore(false);
    }
  }

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <Link href="/dashboard/customers/create" className={buttonVariants()}>
            Create customer
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Customers of{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <Card className="mt-6">
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">No customers yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((customer) => (
                  <li key={customer.id} className="py-3">
                    <Link
                      href={`/dashboard/customers/${customer.id}`}
                      className="flex items-center justify-between hover:text-slate-900"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {customer.displayName ?? customer.email ?? customer.id}
                        </p>
                        <p className="text-xs text-slate-500">{customer.email ?? "No email"}</p>
                      </div>
                      <Badge variant="outline">{customer.type.toLowerCase()}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {nextCursor ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function CustomersListPage() {
  return (
    <ProtectedRoute>
      <CustomersListContent />
    </ProtectedRoute>
  );
}
