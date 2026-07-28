"use client";

import { useCallback, useEffect, useState } from "react";
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
import { PortalNav } from "../../../components/portal-nav";
import { CustomerSwitcher } from "../../../components/customer-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useCustomer } from "../../../lib/customer-context";
import { ApiError } from "../../../lib/api-client";
import { licenseStatusVariant, type License } from "../../../lib/licenses-types";

function LicensesContent() {
  const { authedFetch } = useAuth();
  const { customers, selectedCustomerId, selectCustomer } = useCustomer();
  const [items, setItems] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedCustomerId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<License[]>(
        `/customer-portal/customers/${selectedCustomerId}/licenses`,
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load licenses.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedCustomerId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <h1 className="text-2xl font-semibold text-slate-900">Licenses</h1>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No licenses found for this account.</p>
        ) : (
          <Table className="mt-8">
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seats</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((license) => (
                <TableRow key={license.id}>
                  <TableCell>{license.type}</TableCell>
                  <TableCell>
                    <Badge variant={licenseStatusVariant(license.status)}>{license.status}</Badge>
                  </TableCell>
                  <TableCell>{license.seatLimit ?? "—"}</TableCell>
                  <TableCell>{license.deviceLimit ?? "—"}</TableCell>
                  <TableCell>{new Date(license.issuedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {license.expiresAt ? new Date(license.expiresAt).toLocaleDateString() : "Never"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </main>
    </>
  );
}

export default function LicensesPage() {
  return (
    <ProtectedRoute>
      <LicensesContent />
    </ProtectedRoute>
  );
}
