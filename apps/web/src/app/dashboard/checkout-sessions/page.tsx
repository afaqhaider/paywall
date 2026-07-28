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
  buttonVariants,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { PaymentCheckoutSession } from "../../../lib/payments-types";

function CheckoutSessionsListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [items, setItems] = useState<PaymentCheckoutSession[]>([]);
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
      const data = await authedFetch<PaymentCheckoutSession[]>(
        `/organizations/${selectedOrgId}/checkout-sessions`,
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load checkout sessions.");
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Checkout sessions</h1>
          <Link href="/dashboard/checkout-sessions/create" className={buttonVariants()}>
            Create checkout session
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Checkout sessions for{" "}
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
          <p className="mt-8 text-sm text-slate-500">No checkout sessions yet.</p>
        ) : (
          <div className="mt-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/checkout-sessions/${session.id}`}
                        className="text-slate-900 hover:underline"
                      >
                        {session.customerId}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{session.providerId}</TableCell>
                    <TableCell>
                      <Badge variant={session.status === "COMPLETE" ? "success" : "outline"}>
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>{new Date(session.createdAt).toLocaleString()}</TableCell>
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

export default function CheckoutSessionsListPage() {
  return (
    <ProtectedRoute>
      <CheckoutSessionsListContent />
    </ProtectedRoute>
  );
}
