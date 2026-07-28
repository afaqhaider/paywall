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
import type { Coupon } from "../../../lib/coupons-types";
import type { CursorResult } from "../../../lib/cursor-types";

function CouponsListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [items, setItems] = useState<Coupon[]>([]);
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
      const data = await authedFetch<CursorResult<Coupon>>(
        `/organizations/${selectedOrgId}/coupons`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load coupons.");
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
      const data = await authedFetch<CursorResult<Coupon>>(
        `/organizations/${selectedOrgId}/coupons?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more coupons.");
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
          <h1 className="text-2xl font-semibold text-slate-900">Coupons</h1>
          <Link href="/dashboard/coupons/create" className={buttonVariants()}>
            Create coupon
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Discounts for{" "}
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
              <p className="text-sm text-slate-500">No coupons yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((coupon) => (
                  <li key={coupon.id} className="py-3">
                    <Link
                      href={`/dashboard/coupons/${coupon.id}`}
                      className="flex items-center justify-between hover:text-slate-900"
                    >
                      <div>
                        <p className="font-mono text-sm font-medium text-slate-900">
                          {coupon.code}
                        </p>
                        <p className="text-xs text-slate-500">
                          {coupon.discountType === "PERCENTAGE"
                            ? `${coupon.percentOff ?? 0}% off`
                            : `${coupon.amountOffMinor ?? 0} minor units off`}{" "}
                          - {coupon.duration.toLowerCase()}
                        </p>
                      </div>
                      <Badge variant={coupon.status === "ACTIVE" ? "success" : "outline"}>
                        {coupon.status}
                      </Badge>
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

export default function CouponsListPage() {
  return (
    <ProtectedRoute>
      <CouponsListContent />
    </ProtectedRoute>
  );
}
