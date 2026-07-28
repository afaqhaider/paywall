"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import { formatMinorUnits } from "../../../../lib/money";
import { transactionStatusVariant, type PaymentTransaction } from "../../../../lib/payments-types";

function TransactionDetailContent() {
  const { transactionId } = useParams<{ transactionId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PaymentTransaction>(
        `/organizations/${selectedOrgId}/transactions/${transactionId}`,
      );
      setTransaction(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load transaction.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, transactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleMarkSucceeded() {
    if (!selectedOrgId) return;
    setMarking(true);
    setActionMessage(null);
    setError(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/transactions/${transactionId}/mark-succeeded`,
        { method: "POST" },
      );
      setActionMessage("Transaction marked succeeded.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark transaction succeeded.");
    } finally {
      setMarking(false);
    }
  }

  async function handleRefund(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setRefunding(true);
    setActionMessage(null);
    setError(null);
    try {
      await authedFetch(`/organizations/${selectedOrgId}/transactions/${transactionId}/refunds`, {
        method: "POST",
        body: JSON.stringify({
          amountMinor: refundAmount ? Number(refundAmount) : undefined,
          reason: refundReason || undefined,
        }),
      });
      setRefundAmount("");
      setRefundReason("");
      setActionMessage("Refund created.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create refund.");
    } finally {
      setRefunding(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/dashboard/transactions"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Transactions
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        {loading || !transaction ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {formatMinorUnits(transaction.amountMinor, transaction.currency)}
                </h1>
                <p className="mt-1 text-sm text-slate-500">Customer {transaction.customerId}</p>
              </div>
              <Badge variant={transactionStatusVariant(transaction.status)}>
                {transaction.status}
              </Badge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="text-slate-500">Provider:</span>{" "}
                  <span className="font-mono text-xs">{transaction.providerId}</span>
                </p>
                <p>
                  <span className="text-slate-500">Provider transaction ID:</span>{" "}
                  {transaction.providerTransactionId ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Provider reference:</span>{" "}
                  {transaction.providerReference ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Subscription:</span>{" "}
                  {transaction.subscriptionId ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Checkout session:</span>{" "}
                  {transaction.checkoutSessionId ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Failure reason:</span>{" "}
                  {transaction.failureReason ?? "—"}
                </p>
                <p>
                  <span className="text-slate-500">Created:</span>{" "}
                  {new Date(transaction.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {transaction.status === "PENDING" ? (
                  <div>
                    <Button disabled={marking} onClick={() => void handleMarkSucceeded()}>
                      {marking ? "Working..." : "Mark succeeded"}
                    </Button>
                    <p className="mt-1 text-xs text-slate-500">
                      Use this to reconcile a manually recorded or bank transfer payment.
                    </p>
                  </div>
                ) : null}

                <form
                  onSubmit={handleRefund}
                  className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
                  noValidate
                >
                  <div>
                    <Label htmlFor="refundAmount">Amount (minor units)</Label>
                    <Input
                      id="refundAmount"
                      type="number"
                      min={1}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="Full refund"
                      className="w-48"
                    />
                  </div>
                  <div>
                    <Label htmlFor="refundReason">Reason</Label>
                    <Input
                      id="refundReason"
                      maxLength={500}
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Optional"
                      className="w-64"
                    />
                  </div>
                  <Button type="submit" variant="outline" disabled={refunding}>
                    {refunding ? "Refunding..." : "Refund"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Attempts</CardTitle>
              </CardHeader>
              <CardContent>
                {!transaction.attempts || transaction.attempts.length === 0 ? (
                  <p className="text-sm text-slate-500">No attempts recorded.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Failure</TableHead>
                        <TableHead>Occurred</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transaction.attempts.map((attempt) => (
                        <TableRow key={attempt.id}>
                          <TableCell>{attempt.attemptNumber}</TableCell>
                          <TableCell>{attempt.status}</TableCell>
                          <TableCell>{attempt.failureMessage ?? "—"}</TableCell>
                          <TableCell>{new Date(attempt.occurredAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Refunds</CardTitle>
              </CardHeader>
              <CardContent>
                {!transaction.refunds || transaction.refunds.length === 0 ? (
                  <p className="text-sm text-slate-500">No refunds yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transaction.refunds.map((refund) => (
                        <TableRow key={refund.id}>
                          <TableCell>
                            {formatMinorUnits(refund.amountMinor, refund.currency)}
                          </TableCell>
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
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Disputes</CardTitle>
              </CardHeader>
              <CardContent>
                {!transaction.disputes || transaction.disputes.length === 0 ? (
                  <p className="text-sm text-slate-500">No disputes.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transaction.disputes.map((dispute) => (
                        <TableRow key={dispute.id}>
                          <TableCell>
                            {formatMinorUnits(dispute.amountMinor, dispute.currency)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={dispute.status === "WON" ? "success" : "outline"}>
                              {dispute.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{dispute.reason ?? "—"}</TableCell>
                          <TableCell>{new Date(dispute.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function TransactionDetailPage() {
  return (
    <ProtectedRoute>
      <TransactionDetailContent />
    </ProtectedRoute>
  );
}
