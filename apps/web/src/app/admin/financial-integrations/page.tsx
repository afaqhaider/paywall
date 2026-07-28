"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
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
import type { AdminFinancialIntegrationListItem } from "../../../lib/admin-financial-types";

function statusVariant(status: string): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "CONNECTED":
      return "success";
    case "FAILED":
    case "DISCONNECTED":
      return "destructive";
    case "PENDING_TEST":
      return "outline";
    default:
      return "default";
  }
}

export default function AdminFinancialIntegrationsPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<AdminFinancialIntegrationListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<AdminFinancialIntegrationListItem>>(
        `/admin/financial-integrations`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load financial integrations.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedFetch<CursorResult<AdminFinancialIntegrationListItem>>(
        `/admin/financial-integrations?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more integrations.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Financial Integrations</h1>
      <p className="mt-1 text-sm text-slate-500">
        ERP / financial provider connection status for every organization. See{" "}
        <Link href="/admin/erp-status" className="underline">
          ERP Status
        </Link>{" "}
        for sync queues and retries.
      </p>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No financial integrations found.</p>
      ) : (
        <>
          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last synced</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((fi, i) => (
                <TableRow key={`${fi.organizationId}-${i}`}>
                  <TableCell>
                    <Link href={`/admin/organizations/${fi.organizationId}`} className="underline">
                      {fi.organizationName ?? fi.organizationId}
                    </Link>
                  </TableCell>
                  <TableCell>{fi.provider}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(fi.status)}>{fi.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {fi.lastSyncedAt ? new Date(fi.lastSyncedAt).toLocaleString() : "never"}
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
  );
}
