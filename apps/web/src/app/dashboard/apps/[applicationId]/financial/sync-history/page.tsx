"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../../../components/protected-route";
import { DashboardNav } from "../../../../../../components/dashboard-nav";
import { AppNav } from "../../../../../../components/app-nav";
import { useAuth } from "../../../../../../lib/auth-context";
import { useOrg } from "../../../../../../lib/org-context";
import { ApiError } from "../../../../../../lib/api-client";
import type { CursorResult } from "../../../../../../lib/cursor-types";
import {
  syncStatusVariant,
  type FinancialSyncHistoryItem,
  type FinancialSyncStatus,
} from "../../../../../../lib/financial-sync-types";

const STATUS_FILTERS: (FinancialSyncStatus | "")[] = [
  "",
  "PENDING",
  "RETRYING",
  "SYNCED",
  "FAILED",
  "DEAD_LETTER",
];

function SyncHistoryContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [items, setItems] = useState<FinancialSyncHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FinancialSyncStatus | "">("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (statusFilter) params.set("status", statusFilter);
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [statusFilter],
  );

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<FinancialSyncHistoryItem>>(
        `/organizations/${selectedOrgId}/financial-sync/history${buildQuery()}`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load sync history.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!selectedOrgId || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedFetch<CursorResult<FinancialSyncHistoryItem>>(
        `/organizations/${selectedOrgId}/financial-sync/history${buildQuery(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more sync history.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleRetry(id: string) {
    if (!selectedOrgId) return;
    setRetryingId(id);
    setError(null);
    try {
      await authedFetch(`/organizations/${selectedOrgId}/financial-sync/history/${id}/retry`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not retry this sync.");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <AppNav applicationId={applicationId} />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">ERP Sync History</h1>
          <Link
            href={`/dashboard/apps/${applicationId}/financial`}
            className="text-sm text-slate-500 underline"
          >
            Back to Financial
          </Link>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="statusFilter">
              Status
            </label>
            <Select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FinancialSyncStatus | "")}
              className="w-48"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s || "all"} value={s}>
                  {s || "All statuses"}
                </option>
              ))}
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
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No sync history yet.</p>
        ) : (
          <>
            <Table className="mt-6">
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>ERP reference</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/dashboard/apps/${applicationId}/financial/sync-history/${item.id}`}
                        className="underline"
                      >
                        {item.financialEventId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={syncStatusVariant(item.status)}>{item.status}</Badge>
                    </TableCell>
                    <TableCell>{item.attemptCount}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.erpReferenceNumber ?? "—"}
                    </TableCell>
                    <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {item.status === "FAILED" || item.status === "DEAD_LETTER" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={retryingId === item.id}
                          onClick={() => void handleRetry(item.id)}
                        >
                          {retryingId === item.id ? "Retrying..." : "Retry"}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

export default function SyncHistoryPage() {
  return (
    <ProtectedRoute>
      <SyncHistoryContent />
    </ProtectedRoute>
  );
}
