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
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { PaymentMethod } from "../../../lib/payments-types";

function PaymentMethodsListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [items, setItems] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PaymentMethod[]>(
        `/organizations/${selectedOrgId}/payment-methods`,
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load payment methods.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRemove(paymentMethodId: string) {
    if (!selectedOrgId) return;
    setRemovingId(paymentMethodId);
    setError(null);
    try {
      await authedFetch(`/organizations/${selectedOrgId}/payment-methods/${paymentMethodId}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove payment method.");
    } finally {
      setRemovingId(null);
    }
  }

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
        <h1 className="text-2xl font-semibold text-slate-900">Payment methods</h1>
        <p className="mt-1 text-sm text-slate-500">
          Stored payment methods for{" "}
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
          <p className="mt-8 text-sm text-slate-500">No payment methods yet.</p>
        ) : (
          <div className="mt-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Last 4</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((method) => (
                  <TableRow key={method.id}>
                    <TableCell>{method.type}</TableCell>
                    <TableCell>{method.brand ?? "—"}</TableCell>
                    <TableCell>{method.last4 ?? "—"}</TableCell>
                    <TableCell>{method.isDefault ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <Badge variant={method.status === "ACTIVE" ? "success" : "outline"}>
                        {method.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {method.expiresAt ? new Date(method.expiresAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {method.status === "ACTIVE" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={removingId === method.id}
                          onClick={() => void handleRemove(method.id)}
                        >
                          {removingId === method.id ? "Removing..." : "Remove"}
                        </Button>
                      ) : null}
                    </TableCell>
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

export default function PaymentMethodsListPage() {
  return (
    <ProtectedRoute>
      <PaymentMethodsListContent />
    </ProtectedRoute>
  );
}
