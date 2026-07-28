"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
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
import { formatMinorUnits } from "../../../lib/money";
import type { PaymentRefund } from "../../../lib/payments-types";

function RefundsListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [items, setItems] = useState<PaymentRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PaymentRefund[]>(`/organizations/${selectedOrgId}/refunds`);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load refunds.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <h1 className="text-2xl font-semibold text-slate-900">Refunds</h1>
        <p className="mt-1 text-sm text-slate-500">
          Refunds for{" "}
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
          <p className="mt-8 text-sm text-slate-500">No refunds yet.</p>
        ) : (
          <div className="mt-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((refund) => (
                  <TableRow key={refund.id}>
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`/dashboard/transactions/${refund.transactionId}`}
                        className="text-slate-900 hover:underline"
                      >
                        {refund.transactionId}
                      </Link>
                    </TableCell>
                    <TableCell>{formatMinorUnits(refund.amountMinor, refund.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={refund.status === "SUCCEEDED" ? "success" : "outline"}>
                        {refund.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{refund.reason ?? "—"}</TableCell>
                    <TableCell>{new Date(refund.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </>
  );
}

export default function RefundsListPage() {
  return (
    <ProtectedRoute>
      <RefundsListContent />
    </ProtectedRoute>
  );
}
