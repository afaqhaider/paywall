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
import type { PaymentCheckoutSession } from "../../../../lib/payments-types";

function CheckoutSessionDetailContent() {
  const { checkoutSessionId } = useParams<{ checkoutSessionId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [session, setSession] = useState<PaymentCheckoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PaymentCheckoutSession>(
        `/organizations/${selectedOrgId}/checkout-sessions/${checkoutSessionId}`,
      );
      setSession(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load checkout session.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, checkoutSessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/dashboard/checkout-sessions"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Checkout sessions
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading || !session ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Customer {session.customerId}
                </h1>
                <p className="mt-1 font-mono text-sm text-slate-500">{session.providerId}</p>
              </div>
              <Badge variant={session.status === "COMPLETE" ? "success" : "outline"}>
                {session.status}
              </Badge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm text-slate-700">
                <p>
                  <span className="text-slate-500">Checkout URL:</span>{" "}
                  <a
                    href={session.checkoutUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-900 underline"
                  >
                    {session.checkoutUrl}
                  </a>
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <p>
                    <span className="text-slate-500">Provider reference:</span>{" "}
                    {session.providerReference}
                  </p>
                  <p>
                    <span className="text-slate-500">Price:</span> {session.priceId ?? "—"}
                  </p>
                  <p>
                    <span className="text-slate-500">Product:</span> {session.productId ?? "—"}
                  </p>
                  <p>
                    <span className="text-slate-500">Plan:</span> {session.planId ?? "—"}
                  </p>
                  <p>
                    <span className="text-slate-500">Subscription:</span>{" "}
                    {session.subscriptionId ?? "—"}
                  </p>
                  <p>
                    <span className="text-slate-500">Expires:</span>{" "}
                    {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : "—"}
                  </p>
                  <p>
                    <span className="text-slate-500">Completed:</span>{" "}
                    {session.completedAt ? new Date(session.completedAt).toLocaleString() : "—"}
                  </p>
                  <p>
                    <span className="text-slate-500">Created:</span>{" "}
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function CheckoutSessionDetailPage() {
  return (
    <ProtectedRoute>
      <CheckoutSessionDetailContent />
    </ProtectedRoute>
  );
}
