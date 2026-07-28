"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import { syncStatusVariant } from "../../../lib/financial-sync-types";
import type {
  AdminFinancialEvent,
  AdminFinancialFailedTransaction,
  AdminFinancialSyncItem,
} from "../../../lib/admin-financial-types";

function useCursorList<T>(path: string) {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<T>>(path);
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, nextCursor, loading, error, reload: load };
}

export default function AdminErpStatusPage() {
  const { authedFetch } = useAuth();
  const [retryBusy, setRetryBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const pending = useCursorList<AdminFinancialSyncItem>("/admin/financial/sync/pending");
  const deadLetter = useCursorList<AdminFinancialSyncItem>("/admin/financial/sync/dead-letter");
  const failedTransactions = useCursorList<AdminFinancialFailedTransaction>(
    "/admin/financial/sync/failed-transactions",
  );
  const events = useCursorList<AdminFinancialEvent>("/admin/financial/events");

  async function handleRetry(id: string, reload: () => Promise<void>) {
    setRetryBusy(id);
    setActionError(null);
    try {
      await authedFetch(`/admin/financial/sync/${id}/retry`, { method: "POST" });
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not retry sync.");
    } finally {
      setRetryBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">ERP Status</h1>
      <p className="mt-1 text-sm text-slate-500">
        Platform-wide financial sync queue - pending, dead-letter, failed transactions and raw
        events.
      </p>

      {actionError ? (
        <Alert variant="destructive" className="mt-4">
          {actionError}
        </Alert>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Pending ({pending.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.error ? <Alert variant="destructive">{pending.error}</Alert> : null}
          {pending.loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : pending.items.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing pending.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.provider}</TableCell>
                    <TableCell>
                      <Badge variant={syncStatusVariant(item.status)}>{item.status}</Badge>
                    </TableCell>
                    <TableCell>{item.attemptCount}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={retryBusy !== null}
                        onClick={() => void handleRetry(item.id, pending.reload)}
                      >
                        {retryBusy === item.id ? "Retrying..." : "Retry"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Dead Letter ({deadLetter.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {deadLetter.error ? <Alert variant="destructive">{deadLetter.error}</Alert> : null}
          {deadLetter.loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : deadLetter.items.length === 0 ? (
            <p className="text-sm text-slate-500">No dead-lettered syncs.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deadLetter.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.provider}</TableCell>
                    <TableCell>
                      <Badge variant={syncStatusVariant(item.status)}>{item.status}</Badge>
                    </TableCell>
                    <TableCell>{item.attemptCount}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(item.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={retryBusy !== null}
                        onClick={() => void handleRetry(item.id, deadLetter.reload)}
                      >
                        {retryBusy === item.id ? "Retrying..." : "Retry"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Failed Transactions ({failedTransactions.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {failedTransactions.error ? (
            <Alert variant="destructive">{failedTransactions.error}</Alert>
          ) : null}
          {failedTransactions.loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : failedTransactions.items.length === 0 ? (
            <p className="text-sm text-slate-500">No failed transactions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedTransactions.items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">
                      {t.organizationName ?? t.organizationId}
                    </TableCell>
                    <TableCell>
                      {t.amountMinor !== undefined ? `${t.amountMinor} ${t.currency ?? ""}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{t.failureReason ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(t.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent Events ({events.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {events.error ? <Alert variant="destructive">{events.error}</Alert> : null}
          {events.loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : events.items.length === 0 ? (
            <p className="text-sm text-slate-500">No events.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.type}</TableCell>
                    <TableCell className="text-xs">{e.organizationId ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(e.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
