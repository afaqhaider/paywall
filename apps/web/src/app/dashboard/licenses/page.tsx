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
  CardHeader,
  CardTitle,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import { licenseStatusVariant, type License } from "../../../lib/licenses-types";

function LicensesListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [items, setItems] = useState<License[]>([]);
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
      const data = await authedFetch<CursorResult<License>>(
        `/organizations/${selectedOrgId}/licenses`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load licenses.");
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
      const data = await authedFetch<CursorResult<License>>(
        `/organizations/${selectedOrgId}/licenses?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more licenses.");
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
          <h1 className="text-2xl font-semibold text-slate-900">Licenses</h1>
          <Link href="/dashboard/licenses/create" className={buttonVariants()}>
            Create license
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Licenses for{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">
            No licenses yet. Create the first one for this organization.
          </p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((license) => (
                <Link key={license.id} href={`/dashboard/licenses/${license.id}`}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-slate-900">
                        <span className="text-base font-semibold">{license.type}</span>
                        <Badge variant={licenseStatusVariant(license.status)}>
                          {license.status}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-mono text-xs text-slate-500">{license.id}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {license.seatLimit ? `${license.seatLimit} seats` : null}
                        {license.seatLimit && license.deviceLimit ? " · " : null}
                        {license.deviceLimit ? `${license.deviceLimit} devices` : null}
                        {!license.seatLimit && !license.deviceLimit ? "No limits set" : null}
                      </p>
                      {license.expiresAt ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Expires {new Date(license.expiresAt).toLocaleDateString()}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            {nextCursor ? (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}

export default function LicensesListPage() {
  return (
    <ProtectedRoute>
      <LicensesListContent />
    </ProtectedRoute>
  );
}
