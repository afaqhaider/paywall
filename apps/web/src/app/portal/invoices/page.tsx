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
  customerInvoiceStatusVariant,
  type CustomerInvoice,
  type InvoiceDownloadResult,
} from "../../../lib/customer-portal-types";

function InvoicesContent() {
  const { authedFetch } = useAuth();
  const { customers, selectedCustomerId, selectCustomer } = useCustomer();
  const [items, setItems] = useState<CustomerInvoice[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [search, status],
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
      const data = await authedFetch<CursorResult<CustomerInvoice>>(
        `/customer-portal/customers/${selectedCustomerId}/invoices${buildQuery()}`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load invoices.");
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
      const data = await authedFetch<CursorResult<CustomerInvoice>>(
        `/customer-portal/customers/${selectedCustomerId}/invoices${buildQuery(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more invoices.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDownload(invoiceId: string) {
    if (!selectedCustomerId) return;
    setDownloadingId(invoiceId);
    setNotice(null);
    setError(null);
    try {
      const result = await authedFetch<InvoiceDownloadResult>(
        `/customer-portal/customers/${selectedCustomerId}/invoices/${invoiceId}/download`,
      );
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        setNotice(result.message ?? "The PDF for this invoice isn't available yet.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not download this invoice.");
    } finally {
      setDownloadingId(null);
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
        <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="search">
              Search
            </label>
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Invoice number…"
              className="w-48"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="status">
              Status
            </label>
            <Input
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="PAID, OPEN…"
              className="w-40"
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
        {notice ? <Alert className="mt-4">{notice}</Alert> : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No invoices found.</p>
        ) : (
          <>
            <Table className="mt-8">
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount due</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs">
                      {invoice.invoiceNumber ?? invoice.id}
                    </TableCell>
                    <TableCell>
                      {invoice.status ? (
                        <Badge variant={customerInvoiceStatusVariant(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {typeof invoice.amountDueMinor === "number" && invoice.currency
                        ? formatMinorUnits(invoice.amountDueMinor, invoice.currency)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {invoice.issuedAt
                        ? new Date(invoice.issuedAt).toLocaleDateString()
                        : invoice.createdAt
                          ? new Date(invoice.createdAt).toLocaleDateString()
                          : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingId === invoice.id}
                        onClick={() => void handleDownload(invoice.id)}
                      >
                        {downloadingId === invoice.id ? "Downloading…" : "Download PDF"}
                      </Button>
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

export default function InvoicesPage() {
  return (
    <ProtectedRoute>
      <InvoicesContent />
    </ProtectedRoute>
  );
}
