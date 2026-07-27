"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { AppNav } from "../../../../components/app-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import type { Application } from "../../../../lib/applications-types";

function ApplicationOverviewContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<Application>(
        `/organizations/${selectedOrgId}/applications/${applicationId}`,
      );
      setApp(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load application.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleArchiveToggle() {
    if (!app || !selectedOrgId) return;
    setActionMessage(null);
    try {
      const action = app.status === "ACTIVE" ? "archive" : "restore";
      await authedFetch(`/organizations/${selectedOrgId}/applications/${applicationId}/${action}`, {
        method: "POST",
      });
      await load();
      setActionMessage(action === "archive" ? "Application archived." : "Application restored.");
    } catch (err) {
      setActionMessage(
        err instanceof ApiError ? err.message : "Could not update application status.",
      );
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <AppNav applicationId={applicationId} />

        {error ? (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mb-4">{actionMessage}</Alert> : null}

        {loading || !app ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {app.displayName ?? app.name}
                </h1>
                <p className="mt-1 text-sm text-slate-500">/{app.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={app.status === "ACTIVE" ? "success" : "outline"}>
                  {app.status}
                </Badge>
                <Badge variant="outline">{app.visibility.toLowerCase()}</Badge>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-700">
                  <p>{app.description || "No description yet."}</p>
                  {app.category ? (
                    <p className="text-xs text-slate-500">Category: {app.category}</p>
                  ) : null}
                  {app.bundleIdentifier ? (
                    <p className="text-xs text-slate-500">iOS bundle ID: {app.bundleIdentifier}</p>
                  ) : null}
                  {app.packageName ? (
                    <p className="text-xs text-slate-500">Android package: {app.packageName}</p>
                  ) : null}
                  {app.webIdentifier ? (
                    <p className="text-xs text-slate-500">Web identifier: {app.webIdentifier}</p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lifecycle</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-700">
                  <p className="text-xs text-slate-500">
                    Created {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                  <Button variant="outline" size="sm" onClick={handleArchiveToggle}>
                    {app.status === "ACTIVE" ? "Archive application" : "Restore application"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function ApplicationOverviewPage() {
  return (
    <ProtectedRoute>
      <ApplicationOverviewContent />
    </ProtectedRoute>
  );
}
