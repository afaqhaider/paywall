"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import { formatMinorUnits } from "../../../../lib/money";
import { invoiceStatusVariant, type PaymentInvoice } from "../../../../lib/payments-types";

function InvoiceDetailContent() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [invoice, setInvoice] = useState<PaymentInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PaymentInvoice>(
        `/organizations/${selectedOrgId}/invoices/${invoiceId}`,
      );
      setInvoice(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load invoice.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, invoiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/dashboard/invoices" className="text-sm text-slate-500 hover:text-slate-900">
          ← Invoices
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading || !invoice ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {formatMinorUnits(invoice.amountDueMinor, invoice.currency)}
                </h1>
                <p className="mt-1 text-sm text-slate-500">Customer {invoice.customerId}</p>
              </div>
              <Badge variant={invoiceStatusVariant(invoice.status)}>{invoice.status}</Badge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="text-slate-500">Provider:</span>{" "}
                  <span className="font-mono text-xs">{invoice.providerId}</span>
                </p>
                <p>
                  <span className="text-slate-500">Provider invoice ID:</span>{" "}
                  {invoice.providerInvoiceId ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Subscription:</span>{" "}
                  {invoice.subscriptionId ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Amount paid:</span>{" "}
                  {formatMinorUnits(invoice.amountPaidMinor, invoice.currency)}
                </p>
                <p>
                  <span className="text-slate-500">Period:</span>{" "}
                  {invoice.periodStart ? new Date(invoice.periodStart).toLocaleDateString() : "—"} →{" "}
                  {invoice.periodEnd ? new Date(invoice.periodEnd).toLocaleDateString() : "—"}
                </p>
                <p>
                  <span className="text-slate-500">Issued:</span>{" "}
                  {invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString() : "—"}
                </p>
                <p>
                  <span className="text-slate-500">Paid:</span>{" "}
                  {invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : "—"}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function InvoiceDetailPage() {
  return (
    <ProtectedRoute>
      <InvoiceDetailContent />
    </ProtectedRoute>
  );
}
