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
  Select,
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
import type { CursorResult } from "../../../../lib/cursor-types";
import type { Customer } from "../../../../lib/customers-types";
import { formatMinorUnits } from "../../../../lib/money";
import type { Plan, Price, Product } from "../../../../lib/products-types";
import {
  SUBSCRIPTION_CHANGE_TYPES,
  subscriptionStatusVariant,
  type Subscription,
  type SubscriptionChange,
  type SubscriptionChangeType,
  type SubscriptionEvent,
  type SubscriptionStatus,
} from "../../../../lib/subscriptions-types";

/** Mirrors the server's ALLOWED_TRANSITIONS map closely enough to decide
 * which lifecycle buttons are worth showing; the server re-validates every
 * transition regardless, so this only needs to avoid obviously bogus
 * actions - not be a perfect copy. */
const ACTIONS_BY_STATUS: Record<SubscriptionStatus, string[]> = {
  INCOMPLETE: ["activate", "cancel"],
  TRIALING: ["activate", "cancel", "expire", "suspend"],
  ACTIVE: ["renew", "pause", "mark-past-due", "cancel", "suspend"],
  PAST_DUE: ["reactivate", "enter-grace-period", "cancel", "suspend"],
  GRACE_PERIOD: ["reactivate", "expire", "cancel", "suspend"],
  PAUSED: ["resume", "cancel", "suspend"],
  CANCELED: ["resume"],
  EXPIRED: [],
  SUSPENDED: ["reactivate", "cancel"],
};

const ACTION_LABELS: Record<string, string> = {
  activate: "Activate",
  renew: "Renew",
  resume: "Resume",
  pause: "Pause",
  "mark-past-due": "Mark past due",
  expire: "Expire",
  reactivate: "Reactivate",
};

function SubscriptionDetailContent() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [price, setPrice] = useState<Price | null>(null);

  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [eventsNextCursor, setEventsNextCursor] = useState<string | null>(null);
  const [changes, setChanges] = useState<SubscriptionChange[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [graceDays, setGraceDays] = useState("");

  const [changeType, setChangeType] = useState<SubscriptionChangeType>("UPGRADE");
  const [targetPlanId, setTargetPlanId] = useState("");
  const [targetPriceId, setTargetPriceId] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("");
  const [immediate, setImmediate] = useState(false);
  const [changePlans, setChangePlans] = useState<Plan[]>([]);
  const [changePrices, setChangePrices] = useState<Price[]>([]);
  const [creatingChange, setCreatingChange] = useState(false);

  const [couponId, setCouponId] = useState("");
  const [promotionCode, setPromotionCode] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const sub = await authedFetch<Subscription>(
        `/organizations/${selectedOrgId}/subscriptions/${subscriptionId}`,
      );
      setSubscription(sub);

      const [customerData, productData, planData] = await Promise.all([
        authedFetch<Customer>(`/organizations/${selectedOrgId}/customers/${sub.customerId}`),
        authedFetch<Product>(`/organizations/${selectedOrgId}/products/${sub.productId}`),
        authedFetch<Plan>(`/plans/${sub.planId}`),
      ]);
      setCustomer(customerData);
      setProduct(productData);
      setPlan(planData);

      // getOne doesn't include line items - the list endpoint does, so pull
      // the matching row from there purely to display the current price.
      try {
        const list = await authedFetch<CursorResult<Subscription>>(
          `/organizations/${selectedOrgId}/subscriptions?limit=100`,
        );
        const match = list.items.find((s) => s.id === sub.id);
        setPrice(match?.items?.[0]?.price ?? null);
      } catch {
        setPrice(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load subscription.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, subscriptionId]);

  const loadEvents = useCallback(async () => {
    try {
      const data = await authedFetch<CursorResult<SubscriptionEvent>>(
        `/subscriptions/${subscriptionId}/events`,
      );
      setEvents(data.items);
      setEventsNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load events.");
    }
  }, [authedFetch, subscriptionId]);

  const loadChanges = useCallback(async () => {
    try {
      const data = await authedFetch<SubscriptionChange[]>(
        `/subscriptions/${subscriptionId}/changes`,
      );
      setChanges(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load scheduled changes.");
    }
  }, [authedFetch, subscriptionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadEvents();
    void loadChanges();
  }, [loadEvents, loadChanges]);

  useEffect(() => {
    if (!subscription) return;
    (async () => {
      try {
        const data = await authedFetch<CursorResult<Plan>>(
          `/products/${subscription.productId}/plans?limit=100`,
        );
        setChangePlans(data.items);
      } catch {
        setChangePlans([]);
      }
    })();
  }, [authedFetch, subscription]);

  useEffect(() => {
    setTargetPriceId("");
    setChangePrices([]);
    if (!targetPlanId) return;
    (async () => {
      try {
        const data = await authedFetch<CursorResult<Price>>(
          `/plans/${targetPlanId}/prices?limit=100`,
        );
        setChangePrices(data.items);
      } catch {
        setChangePrices([]);
      }
    })();
  }, [authedFetch, targetPlanId]);

  async function handleLoadMoreEvents() {
    if (!eventsNextCursor) return;
    try {
      const data = await authedFetch<CursorResult<SubscriptionEvent>>(
        `/subscriptions/${subscriptionId}/events?cursor=${encodeURIComponent(eventsNextCursor)}`,
      );
      setEvents((prev) => [...prev, ...data.items]);
      setEventsNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more events.");
    }
  }

  async function runAction(action: string, body?: Record<string, unknown>) {
    setActionBusy(action);
    setActionMessage(null);
    setError(null);
    try {
      const updated = await authedFetch<Subscription>(
        `/subscriptions/${subscriptionId}/${action}`,
        {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        },
      );
      setSubscription(updated);
      setActionMessage(`Subscription ${action.replace(/-/g, " ")}d.`);
      await Promise.all([loadEvents(), loadChanges()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${action} subscription.`);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleCancelSubscription() {
    await runAction("cancel", {
      atPeriodEnd: cancelAtPeriodEnd,
      reason: cancelReason || undefined,
    });
  }

  async function handleSuspendSubscription() {
    await runAction("suspend", { reason: suspendReason || undefined });
  }

  async function handleEnterGracePeriod() {
    await runAction("enter-grace-period", {
      graceDays: graceDays ? Number(graceDays) : undefined,
    });
  }

  async function handleCreateChange(event: FormEvent) {
    event.preventDefault();
    setCreatingChange(true);
    setError(null);
    try {
      await authedFetch(`/subscriptions/${subscriptionId}/changes`, {
        method: "POST",
        body: JSON.stringify({
          type: changeType,
          targetPlanId: targetPlanId || undefined,
          targetPriceId: targetPriceId || undefined,
          targetQuantity: targetQuantity ? Number(targetQuantity) : undefined,
          immediate,
        }),
      });
      setTargetPlanId("");
      setTargetPriceId("");
      setTargetQuantity("");
      setImmediate(false);
      await Promise.all([loadChanges(), load()]);
      setActionMessage("Change submitted.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create scheduled change.");
    } finally {
      setCreatingChange(false);
    }
  }

  async function handleCancelChange(changeId: string) {
    try {
      await authedFetch(`/subscriptions/${subscriptionId}/changes/${changeId}/cancel`, {
        method: "POST",
      });
      await loadChanges();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel scheduled change.");
    }
  }

  async function handleApplyCoupon(event: FormEvent) {
    event.preventDefault();
    setApplyingCoupon(true);
    setError(null);
    try {
      await authedFetch(`/subscriptions/${subscriptionId}/coupons`, {
        method: "POST",
        body: JSON.stringify({
          couponId: couponId || undefined,
          promotionCode: promotionCode || undefined,
        }),
      });
      setCouponId("");
      setPromotionCode("");
      setActionMessage("Coupon applied.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply coupon.");
    } finally {
      setApplyingCoupon(false);
    }
  }

  const availableActions = subscription ? ACTIONS_BY_STATUS[subscription.status] : [];

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/dashboard/subscriptions"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Subscriptions
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        {loading || !subscription ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {customer?.displayName ?? customer?.email ?? subscription.customerId}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {product?.name ?? subscription.productId} / {plan?.name ?? subscription.planId}
                </p>
              </div>
              <Badge variant={subscriptionStatusVariant(subscription.status)}>
                {subscription.status}
              </Badge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  <span className="text-slate-500">Provider:</span> {subscription.provider}
                </p>
                <p>
                  <span className="text-slate-500">Quantity:</span> {subscription.quantity}
                </p>
                <p>
                  <span className="text-slate-500">Price:</span>{" "}
                  {price
                    ? `${formatMinorUnits(price.amountMinor, price.currency)} / ${price.interval}`
                    : "—"}
                </p>
                <p>
                  <span className="text-slate-500">Version:</span> {subscription.version}
                </p>
                <p>
                  <span className="text-slate-500">Current period:</span>{" "}
                  {subscription.currentPeriodStart
                    ? new Date(subscription.currentPeriodStart).toLocaleDateString()
                    : "—"}{" "}
                  →{" "}
                  {subscription.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    : "—"}
                </p>
                <p>
                  <span className="text-slate-500">Trial:</span>{" "}
                  {subscription.trialStart
                    ? `${new Date(subscription.trialStart).toLocaleDateString()} → ${
                        subscription.trialEnd
                          ? new Date(subscription.trialEnd).toLocaleDateString()
                          : "—"
                      }`
                    : "No trial"}
                </p>
                <p>
                  <span className="text-slate-500">Cancel at period end:</span>{" "}
                  {subscription.cancelAtPeriodEnd ? "Yes" : "No"}
                </p>
                <p>
                  <span className="text-slate-500">Grace period ends:</span>{" "}
                  {subscription.gracePeriodEnd
                    ? new Date(subscription.gracePeriodEnd).toLocaleDateString()
                    : "—"}
                </p>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Lifecycle actions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {availableActions
                    .filter((a) => !["cancel", "suspend", "enter-grace-period"].includes(a))
                    .map((action) => (
                      <Button
                        key={action}
                        variant="outline"
                        size="sm"
                        disabled={actionBusy === action}
                        onClick={() => void runAction(action)}
                      >
                        {actionBusy === action ? "Working..." : (ACTION_LABELS[action] ?? action)}
                      </Button>
                    ))}
                </div>

                {availableActions.includes("cancel") ? (
                  <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <Label htmlFor="cancelReason">Cancel reason</Label>
                      <Input
                        id="cancelReason"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Optional"
                        className="w-56"
                      />
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={cancelAtPeriodEnd}
                        onChange={(e) => setCancelAtPeriodEnd(e.target.checked)}
                      />
                      At period end
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionBusy === "cancel"}
                      onClick={() => void handleCancelSubscription()}
                    >
                      {actionBusy === "cancel" ? "Working..." : "Cancel subscription"}
                    </Button>
                  </div>
                ) : null}

                {availableActions.includes("suspend") ? (
                  <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <Label htmlFor="suspendReason">Suspend reason</Label>
                      <Input
                        id="suspendReason"
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        placeholder="Optional"
                        className="w-56"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionBusy === "suspend"}
                      onClick={() => void handleSuspendSubscription()}
                    >
                      {actionBusy === "suspend" ? "Working..." : "Suspend"}
                    </Button>
                  </div>
                ) : null}

                {availableActions.includes("enter-grace-period") ? (
                  <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <Label htmlFor="graceDays">Grace days</Label>
                      <Input
                        id="graceDays"
                        type="number"
                        min={1}
                        value={graceDays}
                        onChange={(e) => setGraceDays(e.target.value)}
                        placeholder="3"
                        className="w-32"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionBusy === "enter-grace-period"}
                      onClick={() => void handleEnterGracePeriod()}
                    >
                      {actionBusy === "enter-grace-period" ? "Working..." : "Enter grace period"}
                    </Button>
                  </div>
                ) : null}

                {availableActions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No lifecycle actions available from {subscription.status}.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Scheduled changes</CardTitle>
              </CardHeader>
              <CardContent>
                {changes.length === 0 ? (
                  <p className="text-sm text-slate-500">No scheduled changes.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Effective</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {changes.map((change) => (
                        <TableRow key={change.id}>
                          <TableCell>{change.type}</TableCell>
                          <TableCell>
                            <Badge variant={change.status === "PENDING" ? "outline" : "success"}>
                              {change.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(change.effectiveAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {change.status === "PENDING" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleCancelChange(change.id)}
                              >
                                Cancel change
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <form
                  onSubmit={handleCreateChange}
                  className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
                  noValidate
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <Label htmlFor="changeType">Type</Label>
                      <Select
                        id="changeType"
                        value={changeType}
                        onChange={(e) => setChangeType(e.target.value as SubscriptionChangeType)}
                      >
                        {SUBSCRIPTION_CHANGE_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="targetPlanId">Target plan</Label>
                      <Select
                        id="targetPlanId"
                        value={targetPlanId}
                        onChange={(e) => setTargetPlanId(e.target.value)}
                      >
                        <option value="">Unchanged</option>
                        {changePlans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="targetPriceId">Target price</Label>
                      <Select
                        id="targetPriceId"
                        disabled={!targetPlanId}
                        value={targetPriceId}
                        onChange={(e) => setTargetPriceId(e.target.value)}
                      >
                        <option value="">Unchanged</option>
                        {changePrices.map((price) => (
                          <option key={price.id} value={price.id}>
                            {price.currency} {price.amountMinor} / {price.interval}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="targetQuantity">Target quantity</Label>
                      <Input
                        id="targetQuantity"
                        type="number"
                        min={0}
                        value={targetQuantity}
                        onChange={(e) => setTargetQuantity(e.target.value)}
                        placeholder="Unchanged"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={immediate}
                      onChange={(e) => setImmediate(e.target.checked)}
                    />
                    Apply immediately (with proration) instead of at next renewal
                  </label>
                  <Button type="submit" disabled={creatingChange} className="w-fit">
                    {creatingChange ? "Submitting..." : "Submit change"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Apply coupon</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleApplyCoupon}
                  className="flex flex-wrap items-end gap-3"
                  noValidate
                >
                  <div>
                    <Label htmlFor="couponId">Coupon ID</Label>
                    <Input
                      id="couponId"
                      value={couponId}
                      onChange={(e) => setCouponId(e.target.value)}
                      placeholder="uuid"
                      className="w-56"
                    />
                  </div>
                  <div>
                    <Label htmlFor="promotionCode">Or promotion code</Label>
                    <Input
                      id="promotionCode"
                      value={promotionCode}
                      onChange={(e) => setPromotionCode(e.target.value)}
                      placeholder="PROMO2026"
                      className="w-56"
                    />
                  </div>
                  <Button type="submit" disabled={applyingCoupon || (!couponId && !promotionCode)}>
                    {applyingCoupon ? "Applying..." : "Apply coupon"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Event history</CardTitle>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <p className="text-sm text-slate-500">No events yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>{event.type}</TableCell>
                          <TableCell>{event.fromStatus ?? "—"}</TableCell>
                          <TableCell>{event.toStatus ?? "—"}</TableCell>
                          <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {eventsNextCursor ? (
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => void handleLoadMoreEvents()}>
                      Load more
                    </Button>
                  </div>
                ) : null}
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
