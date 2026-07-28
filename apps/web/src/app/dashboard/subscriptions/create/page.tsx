"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardContent, Input, Label, Select } from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import type { CursorResult } from "../../../../lib/cursor-types";
import type { Customer } from "../../../../lib/customers-types";
import type { Plan, Price, Product } from "../../../../lib/products-types";
import {
  SUBSCRIPTION_PROVIDERS,
  type Subscription,
  type SubscriptionProvider,
} from "../../../../lib/subscriptions-types";

function CreateSubscriptionContent() {
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [planId, setPlanId] = useState("");
  const [priceId, setPriceId] = useState("");
  const [provider, setProvider] = useState<SubscriptionProvider>("MANUAL");
  const [quantity, setQuantity] = useState("1");
  const [startTrial, setStartTrial] = useState(false);

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const [customersData, productsData] = await Promise.all([
        authedFetch<CursorResult<Customer>>(`/organizations/${selectedOrgId}/customers?limit=100`),
        authedFetch<CursorResult<Product>>(`/organizations/${selectedOrgId}/products?limit=100`),
      ]);
      setCustomers(customersData.items);
      setProducts(productsData.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load customers/products.");
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    setPlanId("");
    setPlans([]);
    if (!productId) return;
    (async () => {
      try {
        const data = await authedFetch<CursorResult<Plan>>(
          `/products/${productId}/plans?limit=100`,
        );
        setPlans(data.items);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load plans.");
      }
    })();
  }, [authedFetch, productId]);

  useEffect(() => {
    setPriceId("");
    setPrices([]);
    if (!planId) return;
    (async () => {
      try {
        const data = await authedFetch<CursorResult<Price>>(`/plans/${planId}/prices?limit=100`);
        setPrices(data.items);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load prices.");
      }
    })();
  }, [authedFetch, planId]);

  const selectedPlan = plans.find((p) => p.id === planId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) {
      setError("Select an organization first.");
      return;
    }
    if (!customerId || !productId || !planId || !priceId) {
      setError("Select a customer, product, plan, and price.");
      return;
    }

    setError(null);
    setCreating(true);
    try {
      const subscription = await authedFetch<Subscription>(
        `/organizations/${selectedOrgId}/subscriptions`,
        {
          method: "POST",
          body: JSON.stringify({
            customerId,
            productId,
            planId,
            priceId,
            provider,
            quantity: Number(quantity) || 1,
            startTrial,
          }),
        },
      );
      router.push(`/dashboard/subscriptions/${subscription.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create subscription.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Create subscription</h1>
        <p className="mt-1 text-sm text-slate-500">
          Attach a customer to a plan and price, optionally starting a trial.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {error ? <Alert variant="destructive">{error}</Alert> : null}

              <div>
                <Label htmlFor="customerId">Customer</Label>
                <Select
                  id="customerId"
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName ?? c.email ?? c.id}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="productId">Product</Label>
                <Select
                  id="productId"
                  required
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">Select a product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="planId">Plan</Label>
                <Select
                  id="planId"
                  required
                  disabled={!productId}
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                >
                  <option value="">Select a plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="priceId">Price</Label>
                <Select
                  id="priceId"
                  required
                  disabled={!planId}
                  value={priceId}
                  onChange={(e) => setPriceId(e.target.value)}
                >
                  <option value="">Select a price</option>
                  {prices.map((price) => (
                    <option key={price.id} value={price.id}>
                      {price.currency} {price.amountMinor} minor / {price.interval}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="provider">Provider</Label>
                <Select
                  id="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as SubscriptionProvider)}
                >
                  {SUBSCRIPTION_PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={startTrial}
                  onChange={(e) => setStartTrial(e.target.checked)}
                  disabled={!selectedPlan?.trialEligible}
                />
                Start trial
                {selectedPlan && !selectedPlan.trialEligible ? (
                  <span className="text-xs text-slate-400">(plan is not trial-eligible)</span>
                ) : null}
              </label>

              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create subscription"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function CreateSubscriptionPage() {
  return (
    <ProtectedRoute>
      <CreateSubscriptionContent />
    </ProtectedRoute>
  );
}
