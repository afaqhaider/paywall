"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Label,
  Select,
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
import {
  webhookStatusVariant,
  type PaymentProvider,
  type PaymentWebhook,
} from "../../../lib/payments-types";

function PaymentWebhooksListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [providerFilter, setProviderFilter] = useState("");
  const [items, setItems] = useState<PaymentWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProviders = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const data = await authedFetch<PaymentProvider[]>(
        `/organizations/${selectedOrgId}/payment-providers`,
      );
      setProviders(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load providers.");
    }
  }, [authedFetch, selectedOrgId]);

  const load = useCallback(async () => {
    if (!selectedOrgId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = providerFilter ? `?providerId=${encodeURIComponent(providerFilter)}` : "";
      const data = await authedFetch<PaymentWebhook[]>(
        `/organizations/${selectedOrgId}/payment-webhooks${query}`,
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load webhooks.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, providerFilter]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

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
        <h1 className="text-2xl font-semibold text-slate-900">Payment webhooks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Inbound webhook events for{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>.
        </p>

        <div className="mt-4 max-w-xs">
          <Label htmlFor="providerFilter">Filter by provider</Label>
          <Select
            id="providerFilter"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
          >
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </Select>
        </div>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No webhook events yet.</p>
        ) : (
          <div className="mt-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event type</TableHead>
                  <TableHead>Normalized</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-mono text-xs">{webhook.eventType}</TableCell>
                    <TableCell>{webhook.normalizedType ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={webhookStatusVariant(webhook.status)}>{webhook.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-red-700">
                      {webhook.error ?? "—"}
                    </TableCell>
                    <TableCell>{new Date(webhook.receivedAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {webhook.processedAt ? new Date(webhook.processedAt).toLocaleString() : "—"}
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

export default function PaymentWebhooksListPage() {
  return (
    <ProtectedRoute>
      <PaymentWebhooksListContent />
    </ProtectedRoute>
  );
}
