"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import type { Customer } from "../../../lib/customers-types";
import type { Plan, Product } from "../../../lib/products-types";
import { subscriptionStatusVariant, type Subscription } from "../../../lib/subscriptions-types";

function SubscriptionsListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [items, setItems] = useState<Subscription[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [planNames, setPlanNames] = useState<Record<string, string>>({});

  const loadLookups = useCallback(
    async (subs: Subscription[]) => {
      if (!selectedOrgId) return;
      try {
        const [customersData, productsData] = await Promise.all([
          authedFetch<CursorResult<Customer>>(
            `/organizations/${selectedOrgId}/customers?limit=100`,
          ),
          authedFetch<CursorResult<Product>>(`/organizations/${selectedOrgId}/products?limit=100`),
        ]);
        setCustomerNames((prev) => ({
          ...prev,
          ...Object.fromEntries(
            customersData.items.map((c) => [c.id, c.displayName ?? c.email ?? c.id]),
          ),
        }));
        setProductNames((prev) => ({
          ...prev,
          ...Object.fromEntries(productsData.items.map((p) => [p.id, p.name])),
        }));

        const productIds = Array.from(new Set(subs.map((s) => s.productId)));
        const planLists = await Promise.all(
          productIds.map((id) =>
            authedFetch<CursorResult<Plan>>(`/products/${id}/plans?limit=100`),
          ),
        );
        const planMap: Record<string, string> = {};
        planLists.forEach((list) => {
          list.items.forEach((plan) => {
            planMap[plan.id] = plan.name;
          });
        });
        setPlanNames((prev) => ({ ...prev, ...planMap }));
      } catch {
        // Non-fatal - lists still render with raw IDs as a fallback.
      }
    },
    [authedFetch, selectedOrgId],
  );

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
      const data = await authedFetch<CursorResult<Subscription>>(
        `/organizations/${selectedOrgId}/subscriptions`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
      void loadLookups(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, loadLookups]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!selectedOrgId || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedFetch<CursorResult<Subscription>>(
        `/organizations/${selectedOrgId}/subscriptions?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      void loadLookups(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more subscriptions.");
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
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Subscriptions</h1>
          <Link href="/dashboard/subscriptions/create" className={buttonVariants()}>
            Create subscription
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Subscriptions for{" "}
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
              <p className="text-sm text-slate-500">No subscriptions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product / Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Period end</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium text-slate-900">
                        {customerNames[sub.customerId] ?? sub.customerId}
                      </TableCell>
                      <TableCell>
                        {productNames[sub.productId] ?? sub.productId} /{" "}
                        {planNames[sub.planId] ?? sub.planId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={subscriptionStatusVariant(sub.status)}>{sub.status}</Badge>
                      </TableCell>
                      <TableCell>{sub.quantity}</TableCell>
                      <TableCell>
                        {sub.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/subscriptions/${sub.id}`}
                          className="text-sm font-medium text-slate-700 hover:text-slate-900"
                        >
                          View →
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

export default function SubscriptionsListPage() {
  return (
    <ProtectedRoute>
      <SubscriptionsListContent />
    </ProtectedRoute>
  );
}
