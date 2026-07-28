"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../../../../components/protected-route";
import { DashboardNav } from "../../../../../../../components/dashboard-nav";
import { AppNav } from "../../../../../../../components/app-nav";
import { useAuth } from "../../../../../../../lib/auth-context";
import { useOrg } from "../../../../../../../lib/org-context";
import { ApiError } from "../../../../../../../lib/api-client";
import {
  syncStatusVariant,
  type FinancialSyncDetail,
} from "../../../../../../../lib/financial-sync-types";

function SyncDetailContent() {
  const { applicationId, financialSyncId } = useParams<{
    applicationId: string;
    financialSyncId: string;
  }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [detail, setDetail] = useState<FinancialSyncDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<FinancialSyncDetail>(
        `/organizations/${selectedOrgId}/financial-sync/history/${financialSyncId}`,
      );
      setDetail(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this sync record.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, financialSyncId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRetry() {
    if (!selectedOrgId) return;
    setRetrying(true);
    setError(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/financial-sync/history/${financialSyncId}/retry`,
        { method: "POST" },
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not retry this sync.");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <AppNav applicationId={applicationId} />
        <Link
          href={`/dashboard/apps/${applicationId}/financial/sync-history`}
          className="text-sm text-slate-500 underline"
        >
          Back to sync history
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading || !detail ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-slate-900">
                Sync {detail.financialEventId}
              </h1>
              <div className="flex items-center gap-2">
                <Badge variant={syncStatusVariant(detail.status)}>{detail.status}</Badge>
                {detail.status === "FAILED" || detail.status === "DEAD_LETTER" ? (
                  <Button size="sm" disabled={retrying} onClick={() => void handleRetry()}>
                    {retrying ? "Retrying..." : "Retry"}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-slate-700">
                  <p>Provider: {detail.provider}</p>
                  <p>Attempts: {detail.attemptCount}</p>
                  <p className="font-mono text-xs">
                    ERP reference: {detail.erpReferenceNumber ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Created {new Date(detail.createdAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">
                    Completed{" "}
                    {detail.completedAt ? new Date(detail.completedAt).toLocaleString() : "—"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Financial event</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700">Type: {detail.financialEvent.type}</p>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50">
                    {JSON.stringify(detail.financialEvent.payload, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>

            {detail.error ? (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Last error</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-slate-700">
                  <p>{detail.error.error}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(detail.error.occurredAt).toLocaleString()} ·{" "}
                    {detail.error.resolved ? "Resolved" : "Unresolved"}
                  </p>
                </CardContent>
              </Card>
            ) : null}

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Attempt history</CardTitle>
              </CardHeader>
              <CardContent>
                {detail.history.length === 0 ? (
                  <p className="text-sm text-slate-500">No attempts recorded yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead>Executed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.history.map((attempt) => (
                        <TableRow key={attempt.attemptNumber}>
                          <TableCell>{attempt.attemptNumber}</TableCell>
                          <TableCell>
                            <Badge variant={syncStatusVariant(attempt.status)}>
                              {attempt.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{attempt.error ?? "—"}</TableCell>
                          <TableCell>{new Date(attempt.executedAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function SyncDetailPage() {
  return (
    <ProtectedRoute>
      <SyncDetailContent />
    </ProtectedRoute>
  );
}
