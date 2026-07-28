"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { PortalNav } from "../../../../components/portal-nav";
import { CustomerSwitcher } from "../../../../components/customer-switcher";
import { useAuth } from "../../../../lib/auth-context";
import { useCustomer } from "../../../../lib/customer-context";
import { ApiError } from "../../../../lib/api-client";
import { subscriptionStatusVariant } from "../../../../lib/subscriptions-types";
import type { SubscriptionChangeType } from "../../../../lib/subscriptions-types";
import type {
  CustomerSubscription,
  CustomerSubscriptionChange,
} from "../../../../lib/customer-portal-types";

const CHANGE_TYPES: SubscriptionChangeType[] = [
  "UPGRADE",
  "DOWNGRADE",
  "INTERVAL_CHANGE",
  "SEAT_CHANGE",
];

function SubscriptionDetailContent() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const { authedFetch } = useAuth();
  const { customers, selectedCustomerId, selectCustomer } = useCustomer();

  const [subscription, setSubscription] = useState<CustomerSubscription | null>(null);
  const [changes, setChanges] = useState<CustomerSubscriptionChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [changeType, setChangeType] = useState<SubscriptionChangeType>("UPGRADE");
  const [targetPlanId, setTargetPlanId] = useState("");
  const [targetPriceId, setTargetPriceId] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("");
  const [changeImmediate, setChangeImmediate] = useState(false);
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!selectedCustomerId) return;
    setLoading(true);
    setError(null);
    try {
      const [sub, changeHistory] = await Promise.all([
        authedFetch<CustomerSubscription>(
          `/customer-portal/customers/${selectedCustomerId}/subscriptions/${subscriptionId}`,
        ),
        authedFetch<CustomerSubscriptionChange[]>(
          `/customer-portal/customers/${selectedCustomerId}/subscriptions/${subscriptionId}/changes`,
        ).catch(() => []),
      ]);
      setSubscription(sub);
      setChanges(changeHistory);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this subscription.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedCustomerId, subscriptionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: "cancel" | "renew" | "pause" | "resume", body?: unknown) {
    if (!selectedCustomerId) return;
    setActionPending(true);
    setActionMessage(null);
    setError(null);
    try {
      await authedFetch(
        `/customer-portal/customers/${selectedCustomerId}/subscriptions/${subscriptionId}/${action}`,
        { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined },
      );
      setActionMessage(`Subscription ${action === "cancel" ? "canceled" : action + "d"}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${action} this subscription.`);
    } finally {
      setActionPending(false);
    }
  }

  async function handleCancel(event: FormEvent) {
    event.preventDefault();
    await runAction("cancel", {
      immediate: cancelImmediate,
      reason: cancelReason || undefined,
    });
  }

  async function handleChange(event: FormEvent) {
    event.preventDefault();
    if (!selectedCustomerId) return;
    setChangeSubmitting(true);
    setActionMessage(null);
    setError(null);
    try {
      await authedFetch(
        `/customer-portal/customers/${selectedCustomerId}/subscriptions/${subscriptionId}/change`,
        {
          method: "POST",
          body: JSON.stringify({
            type: changeType,
            targetPlanId: targetPlanId || undefined,
            targetPriceId: targetPriceId || undefined,
            targetQuantity: targetQuantity ? Number(targetQuantity) : undefined,
            immediate: changeImmediate,
          }),
        },
      );
      setActionMessage("Plan change submitted.");
      setTargetPlanId("");
      setTargetPriceId("");
      setTargetQuantity("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit plan change.");
    } finally {
      setChangeSubmitting(false);
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
      <main className="mx-auto max-w-4xl px-6 py-10">
        {error ? (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mb-4">{actionMessage}</Alert> : null}

        {loading || !subscription ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {subscription.product?.name ?? subscription.productId}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Plan: {subscription.plan?.name ?? subscription.planId}
                </p>
              </div>
              <Badge variant={subscriptionStatusVariant(subscription.status)}>
                {subscription.status}
              </Badge>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Billing period</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-slate-700">
                  <p>
                    Current period:{" "}
                    {subscription.currentPeriodStart
                      ? new Date(subscription.currentPeriodStart).toLocaleDateString()
                      : "—"}{" "}
                    –{" "}
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                      : "—"}
                  </p>
                  <p>Quantity: {subscription.quantity}</p>
                  {subscription.cancelAtPeriodEnd ? (
                    <p className="text-xs text-amber-600">Scheduled to cancel at period end.</p>
                  ) : null}
                  {subscription.canceledAt ? (
                    <p className="text-xs text-slate-500">
                      Canceled {new Date(subscription.canceledAt).toLocaleDateString()}
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-700">
                  {subscription.items && subscription.items.length > 0 ? (
                    subscription.items.map((item) => (
                      <p key={item.id}>
                        {item.price?.currency} {(item.price?.amountMinor ?? 0) / 100} /{" "}
                        {item.price?.interval?.toLowerCase()} × {item.quantity}
                      </p>
                    ))
                  ) : (
                    <p className="text-slate-500">No item breakdown available.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionPending}
                    onClick={() => void runAction("renew")}
                  >
                    Renew
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionPending}
                    onClick={() => void runAction("pause")}
                  >
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionPending}
                    onClick={() => void runAction("resume")}
                  >
                    Resume
                  </Button>
                </div>

                <form
                  onSubmit={handleCancel}
                  className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
                >
                  <div className="flex-1">
                    <Label htmlFor="cancelReason">Cancellation reason (optional)</Label>
                    <Input
                      id="cancelReason"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={cancelImmediate}
                      onChange={(e) => setCancelImmediate(e.target.checked)}
                    />
                    Cancel immediately
                  </label>
                  <Button type="submit" variant="outline" disabled={actionPending}>
                    Cancel subscription
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Change plan</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChange} className="flex flex-col gap-3" noValidate>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="changeType">Change type</Label>
                      <Select
                        id="changeType"
                        value={changeType}
                        onChange={(e) => setChangeType(e.target.value as SubscriptionChangeType)}
                      >
                        {CHANGE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={changeImmediate}
                          onChange={(e) => setChangeImmediate(e.target.checked)}
                        />
                        Apply immediately (otherwise at period end)
                      </label>
                    </div>
                    <div>
                      <Label htmlFor="targetPlanId">Target plan ID</Label>
                      <Input
                        id="targetPlanId"
                        value={targetPlanId}
                        onChange={(e) => setTargetPlanId(e.target.value)}
                        placeholder="plan_..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="targetPriceId">Target price ID</Label>
                      <Input
                        id="targetPriceId"
                        value={targetPriceId}
                        onChange={(e) => setTargetPriceId(e.target.value)}
                        placeholder="price_..."
                      />
                    </div>
                    <div>
                      <Label htmlFor="targetQuantity">Target quantity / seats</Label>
                      <Input
                        id="targetQuantity"
                        type="number"
                        min={1}
                        value={targetQuantity}
                        onChange={(e) => setTargetQuantity(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-fit" disabled={changeSubmitting}>
                    {changeSubmitting ? "Submitting..." : "Submit plan change"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Change history</CardTitle>
              </CardHeader>
              <CardContent>
                {changes.length === 0 ? (
                  <p className="text-sm text-slate-500">No plan changes yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Effective</TableHead>
                        <TableHead>Applied</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {changes.map((change) => (
                        <TableRow key={change.id}>
                          <TableCell>{change.type}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{change.status}</Badge>
                          </TableCell>
                          <TableCell>{new Date(change.effectiveAt).toLocaleString()}</TableCell>
                          <TableCell>
                            {change.appliedAt ? new Date(change.appliedAt).toLocaleString() : "—"}
                          </TableCell>
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

export default function SubscriptionDetailPage() {
  return (
    <ProtectedRoute>
      <SubscriptionDetailContent />
    </ProtectedRoute>
  );
}
