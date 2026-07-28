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
import { disputeStatusVariant, type PaymentDispute } from "../../../../lib/payments-types";

function DisputeDetailContent() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [dispute, setDispute] = useState<PaymentDispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PaymentDispute>(
        `/organizations/${selectedOrgId}/disputes/${disputeId}`,
      );
      setDispute(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load dispute.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, disputeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/dashboard/disputes" className="text-sm text-slate-500 hover:text-slate-900">
          ← Disputes
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading || !dispute ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {formatMinorUnits(dispute.amountMinor, dispute.currency)}
                </h1>
                <p className="mt-1 font-mono text-sm text-slate-500">
                  Transaction {dispute.transactionId}
                </p>
              </div>
              <Badge variant={disputeStatusVariant(dispute.status)}>{dispute.status}</Badge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="text-slate-500">Provider dispute ID:</span>{" "}
                  {dispute.providerDisputeId}
                </p>
                <p>
                  <span className="text-slate-500">Reason:</span> {dispute.reason ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Evidence due by:</span>{" "}
                  {dispute.evidenceDueBy ? new Date(dispute.evidenceDueBy).toLocaleString() : "—"}
                </p>
                <p>
                  <span className="text-slate-500">Created:</span>{" "}
                  {new Date(dispute.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function DisputeDetailPage() {
  return (
    <ProtectedRoute>
      <DisputeDetailContent />
    </ProtectedRoute>
  );
}
