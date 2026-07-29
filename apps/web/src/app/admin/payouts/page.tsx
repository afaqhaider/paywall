"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  formatMinor,
  type AccruedSummary,
  type PayoutRecord,
} from "../../../lib/admin-payouts-types";

/**
 * Manual payout flow (checkpoint 5 of the SS Zentronics merge plan) - no
 * automated bank transfer yet. An admin creates a payout covering a
 * vendor's currently-unclaimed accrued commission, then separately marks
 * it paid once the actual transfer has happened outside this system.
 */
export default function AdminPayoutsPage() {
  const { authedFetch } = useAuth();
  const [accrued, setAccrued] = useState<AccruedSummary[]>([]);
  const [selectedOrgPayouts, setSelectedOrgPayouts] = useState<Record<string, PayoutRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);
  const [busyPayoutId, setBusyPayoutId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<AccruedSummary[]>("/admin/payouts/accrued");
      setAccrued(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load accrued commission.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadPayoutsFor(organizationId: string) {
    try {
      const data = await authedFetch<PayoutRecord[]>(
        `/admin/payouts/organizations/${organizationId}`,
      );
      setSelectedOrgPayouts((prev) => ({ ...prev, [organizationId]: data }));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not load payouts for this organization.",
      );
    }
  }

  async function handleCreatePayout(organizationId: string) {
    setBusyOrgId(organizationId);
    setError(null);
    try {
      await authedFetch("/admin/payouts", {
        method: "POST",
        body: JSON.stringify({ organizationId }),
      });
      await load();
      await loadPayoutsFor(organizationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create payout.");
    } finally {
      setBusyOrgId(null);
    }
  }

  async function handleMarkPaid(payoutId: string, organizationId: string) {
    setBusyPayoutId(payoutId);
    setError(null);
    try {
      await authedFetch(`/admin/payouts/${payoutId}/mark-paid`, { method: "POST" });
      await loadPayoutsFor(organizationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark this payout paid.");
    } finally {
      setBusyPayoutId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Vendor Payouts</h1>
      <p className="mt-1 text-sm text-slate-500">
        View accrued commission per vendor and mark payouts as paid once transferred manually.
      </p>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      <h2 className="mt-8 text-lg font-medium text-slate-900">Unclaimed accrued commission</h2>
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : accrued.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No unclaimed accrued commission right now.</p>
      ) : (
        <Table className="mt-4">
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Vendor payout owed</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {accrued.map((row) => (
              <TableRow key={`${row.organizationId}:${row.currency}`}>
                <TableCell className="font-mono text-xs">{row.organizationId}</TableCell>
                <TableCell>{row.currency}</TableCell>
                <TableCell>{formatMinor(row.totalVendorPayoutAmountMinor, row.currency)}</TableCell>
                <TableCell>{row.entryCount}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    disabled={busyOrgId === row.organizationId}
                    onClick={() => void handleCreatePayout(row.organizationId)}
                  >
                    Create payout
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={() => void loadPayoutsFor(row.organizationId)}
                  >
                    View payouts
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {Object.entries(selectedOrgPayouts).map(([organizationId, payouts]) => (
        <div key={organizationId} className="mt-8">
          <h3 className="text-sm font-medium text-slate-900">
            Payouts for <span className="font-mono text-xs">{organizationId}</span>
          </h3>
          {payouts.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No payouts yet.</p>
          ) : (
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatMinor(p.amountMinor, p.currency)}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(p.periodStart).toLocaleDateString()} -{" "}
                      {new Date(p.periodEnd).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.status === "PAID" ? "default" : "outline"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.status === "PENDING" ? (
                        <Button
                          size="sm"
                          disabled={busyPayoutId === p.id}
                          onClick={() => void handleMarkPaid(p.id, organizationId)}
                        >
                          Mark paid
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ))}
    </main>
  );
}
