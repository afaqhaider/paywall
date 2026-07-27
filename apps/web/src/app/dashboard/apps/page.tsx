"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
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
import type { ApplicationListResult } from "../../../lib/applications-types";

function ApplicationsListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [result, setResult] = useState<ApplicationListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    if (!selectedOrgId) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<ApplicationListResult>(
        `/organizations/${selectedOrgId}/applications`,
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

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
          <h1 className="text-2xl font-semibold text-slate-900">Applications</h1>
          <Link href="/dashboard/apps/create" className={buttonVariants()}>
            Create application
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Every application registered under{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : !result || result.items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">
            No applications yet. Create the first one for this organization.
          </p>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((app) => (
              <Link key={app.id} href={`/dashboard/apps/${app.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-slate-900">
                      <span className="text-base font-semibold">{app.displayName ?? app.name}</span>
                      <Badge variant={app.status === "ACTIVE" ? "success" : "outline"}>
                        {app.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-500">/{app.slug}</p>
                    {app.category ? (
                      <p className="mt-2 text-xs text-slate-400">{app.category}</p>
                    ) : null}
                    <Badge variant="outline" className="mt-3">
                      {app.visibility.toLowerCase()}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default function ApplicationsListPage() {
  return (
    <ProtectedRoute>
      <ApplicationsListContent />
    </ProtectedRoute>
  );
}
