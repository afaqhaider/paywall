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
  Textarea,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../../../components/protected-route";
import { DashboardNav } from "../../../../../../components/dashboard-nav";
import { useAuth } from "../../../../../../lib/auth-context";
import { ApiError } from "../../../../../../lib/api-client";
import type { CursorResult } from "../../../../../../lib/cursor-types";
import {
  BILLING_INTERVALS,
  PLAN_BILLING_TYPES,
  type BillingInterval,
  type Plan,
  type PlanBillingType,
  type Price,
} from "../../../../../../lib/products-types";
import { formatMinorUnits } from "../../../../../../lib/money";

function PlanDetailContent() {
  const { productId, planId } = useParams<{ productId: string; planId: string }>();
  const { authedFetch } = useAuth();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [billingType, setBillingType] = useState<PlanBillingType>("RECURRING");
  const [trialEligible, setTrialEligible] = useState(false);
  const [trialDays, setTrialDays] = useState("");
  const [seatLimit, setSeatLimit] = useState("");
  const [saving, setSaving] = useState(false);

  const [prices, setPrices] = useState<Price[]>([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesNextCursor, setPricesNextCursor] = useState<string | null>(null);

  const [currency, setCurrency] = useState("USD");
  const [amountMinor, setAmountMinor] = useState("");
  const [priceInterval, setPriceInterval] = useState<BillingInterval>("MONTH");
  const [intervalCount, setIntervalCount] = useState("1");
  const [creatingPrice, setCreatingPrice] = useState(false);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<Plan>(`/plans/${planId}`);
      setPlan(data);
      setName(data.name);
      setDescription(data.description ?? "");
      setBillingType(data.billingType);
      setTrialEligible(data.trialEligible);
      setTrialDays(data.trialDays ? String(data.trialDays) : "");
      setSeatLimit(data.seatLimit ? String(data.seatLimit) : "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load plan.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, planId]);

  const loadPrices = useCallback(async () => {
    setPricesLoading(true);
    try {
      const data = await authedFetch<CursorResult<Price>>(`/plans/${planId}/prices`);
      setPrices(data.items);
      setPricesNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load prices.");
    } finally {
      setPricesLoading(false);
    }
  }, [authedFetch, planId]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  async function handleLoadMorePrices() {
    if (!pricesNextCursor) return;
    try {
      const data = await authedFetch<CursorResult<Price>>(
        `/plans/${planId}/prices?cursor=${encodeURIComponent(pricesNextCursor)}`,
      );
      setPrices((prev) => [...prev, ...data.items]);
      setPricesNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more prices.");
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setActionMessage(null);
    try {
      const updated = await authedFetch<Plan>(`/plans/${planId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description: description || undefined,
          billingType,
          trialEligible,
          trialDays: trialDays ? Number(trialDays) : undefined,
          seatLimit: seatLimit ? Number(seatLimit) : undefined,
        }),
      });
      setPlan(updated);
      setActionMessage("Plan updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update plan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!plan) return;
    setActionMessage(null);
    try {
      const action = plan.status === "ARCHIVED" ? "restore" : "archive";
      const updated = await authedFetch<Plan>(`/plans/${planId}/${action}`, { method: "POST" });
      setPlan(updated);
      setActionMessage(action === "archive" ? "Plan archived." : "Plan restored.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update plan status.");
    }
  }

  async function handleCreatePrice(event: FormEvent) {
    event.preventDefault();
    setCreatingPrice(true);
    setError(null);
    try {
      await authedFetch(`/plans/${planId}/prices`, {
        method: "POST",
        body: JSON.stringify({
          currency: currency.toUpperCase(),
          amountMinor: Number(amountMinor),
          interval: priceInterval,
          intervalCount: Number(intervalCount) || 1,
        }),
      });
      setAmountMinor("");
      await loadPrices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create price.");
    } finally {
      setCreatingPrice(false);
    }
  }

  async function handleArchivePrice(priceId: string) {
    setActionMessage(null);
    try {
      await authedFetch(`/prices/${priceId}/archive`, { method: "POST" });
      await loadPrices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not archive price.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href={`/dashboard/products/${productId}`}
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to product
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        {loading || !plan ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{plan.name}</h1>
                <p className="mt-1 font-mono text-sm text-slate-500">{plan.code}</p>
              </div>
              <Badge variant={plan.status === "ACTIVE" ? "success" : "outline"}>
                {plan.status}
              </Badge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      required
                      maxLength={150}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      maxLength={2000}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="billingType">Billing type</Label>
                      <Select
                        id="billingType"
                        value={billingType}
                        onChange={(e) => setBillingType(e.target.value as PlanBillingType)}
                      >
                        {PLAN_BILLING_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="trialDays">Trial days</Label>
                      <Input
                        id="trialDays"
                        type="number"
                        min={1}
                        max={365}
                        value={trialDays}
                        onChange={(e) => setTrialDays(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="seatLimit">Seat limit</Label>
                      <Input
                        id="seatLimit"
                        type="number"
                        min={1}
                        value={seatLimit}
                        onChange={(e) => setSeatLimit(e.target.value)}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={trialEligible}
                      onChange={(e) => setTrialEligible(e.target.checked)}
                    />
                    Trial eligible
                  </label>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleArchiveToggle}>
                      {plan.status === "ARCHIVED" ? "Restore plan" : "Archive plan"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Prices</CardTitle>
              </CardHeader>
              <CardContent>
                {pricesLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : prices.length === 0 ? (
                  <p className="text-sm text-slate-500">No prices yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Amount</TableHead>
                        <TableHead>Interval</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prices.map((price) => (
                        <TableRow key={price.id}>
                          <TableCell className="font-medium text-slate-900">
                            {formatMinorUnits(price.amountMinor, price.currency)}{" "}
                            <span className="text-xs text-slate-400">
                              ({price.amountMinor} minor units)
                            </span>
                          </TableCell>
                          <TableCell>
                            {price.interval}
                            {price.intervalCount > 1 ? ` x${price.intervalCount}` : ""}
                          </TableCell>
                          <TableCell>{price.countryCode ?? "Global"}</TableCell>
                          <TableCell>
                            <Badge variant={price.status === "ACTIVE" ? "success" : "outline"}>
                              {price.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {price.status === "ACTIVE" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleArchivePrice(price.id)}
                              >
                                Archive
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {pricesNextCursor ? (
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => void handleLoadMorePrices()}>
                      Load more
                    </Button>
                  </div>
                ) : null}

                <form
                  onSubmit={handleCreatePrice}
                  className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
                  noValidate
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <Input
                        id="currency"
                        required
                        maxLength={3}
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        placeholder="USD"
                      />
                    </div>
                    <div>
                      <Label htmlFor="amountMinor">Amount (minor units, e.g. cents)</Label>
                      <Input
                        id="amountMinor"
                        required
                        type="number"
                        min={0}
                        step={1}
                        value={amountMinor}
                        onChange={(e) => setAmountMinor(e.target.value)}
                        placeholder="999"
                      />
                    </div>
                    <div>
                      <Label htmlFor="interval">Interval</Label>
                      <Select
                        id="interval"
                        value={priceInterval}
                        onChange={(e) => setPriceInterval(e.target.value as BillingInterval)}
                      >
                        {BILLING_INTERVALS.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="intervalCount">Interval count</Label>
                      <Input
                        id="intervalCount"
                        type="number"
                        min={1}
                        value={intervalCount}
                        onChange={(e) => setIntervalCount(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={creatingPrice}>
                    {creatingPrice ? "Creating..." : "Create price"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function PlanDetailPage() {
  return (
    <ProtectedRoute>
      <PlanDetailContent />
    </ProtectedRoute>
  );
}
