"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { PortalNav } from "../../../components/portal-nav";
import { CustomerSwitcher } from "../../../components/customer-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useCustomer } from "../../../lib/customer-context";
import { ApiError } from "../../../lib/api-client";
import { formatMinorUnits } from "../../../lib/money";
import type { CursorResult } from "../../../lib/cursor-types";
import {
  customerTransactionStatusVariant,
  type CustomerTransaction,
} from "../../../lib/customer-portal-types";

function TransactionsContent() {
  const { authedFetch } = useAuth();
  const { customers, selectedCustomerId, selectCustomer } = useCustomer();
  const [items, setItems] = useState<CustomerTransaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (status) params.set("status", status);
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [status],
  );

  const load = useCallback(async () => {
    if (!selectedCustomerId) {
      setItems([]);
      setNextCursor(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<CustomerTransaction>>(
        `/customer-portal/customers/${selectedCustomerId}/transactions${buildQuery()}`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load transactions.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedCustomerId, buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!selectedCustomerId || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedFetch<CursorResult<CustomerTransaction>>(
        `/customer-portal/customers/${selectedCustomerId}/transactions${buildQuery(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more transactions.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <PortalNav>
        <CustomerSwitcher
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelect={selectCustomer}
        />
      </PortalNav>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="status">
              Status
            </label>
            <Input
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="SUCCEEDED, FAILED…"
              className="w-48"
            />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Filter
          </Button>
        </form>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No transactions found.</p>
        ) : (
          <>
            <Table className="mt-8">
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Sync status</TableHead>
                  <TableHead>ERP reference</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs">{tx.id}</TableCell>
                    <TableCell>
                      {tx.status ? (
                        <Badge variant={customerTransactionStatusVariant(tx.status)}>
                          {tx.status}
                        </Badge>
                      ) : (
                        "—"
                      )}
                      {tx.refunds && tx.refunds.length > 0 ? (
                        <Badge variant="outline" className="ml-2">
                          refunded
                        </Badge>
                      ) : null}
                      {tx.disputes && tx.disputes.length > 0 ? (
                        <Badge variant="destructive" className="ml-2">
                          disputed
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {typeof tx.amountMinor === "number" && tx.currency
                        ? formatMinorUnits(tx.amountMinor, tx.currency)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {tx.syncStatus ? (
                        <Badge variant="outline">{tx.syncStatus}</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tx.erpReferenceNumber ?? "—"}
                    </TableCell>
                    <TableCell>
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "—"}
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

export default function TransactionsPage() {
  return (
    <ProtectedRoute>
      <TransactionsContent />
    </ProtectedRoute>
  );
}
