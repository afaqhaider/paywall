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
import type { PaymentCheckoutSession, PaymentProvider } from "../../../../lib/payments-types";

function CreateCheckoutSessionContent() {
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();
  const router = useRouter();

  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);

  const [providerId, setProviderId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [planId, setPlanId] = useState("");
  const [priceId, setPriceId] = useState("");
  const [successUrl, setSuccessUrl] = useState("");
  const [cancelUrl, setCancelUrl] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const [providersData, customersData, productsData] = await Promise.all([
        authedFetch<PaymentProvider[]>(`/organizations/${selectedOrgId}/payment-providers`),
        authedFetch<CursorResult<Customer>>(`/organizations/${selectedOrgId}/customers?limit=100`),
        authedFetch<CursorResult<Product>>(`/organizations/${selectedOrgId}/products?limit=100`),
      ]);
      setProviders(providersData);
      setCustomers(customersData.items);
      setProducts(productsData.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load form data.");
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) {
      setError("Select an organization first.");
      return;
    }
    if (!providerId || !customerId || !priceId) {
      setError("Select a provider, customer, and price.");
      return;
    }

    setError(null);
    setCreating(true);
    try {
      const session = await authedFetch<PaymentCheckoutSession>(
        `/organizations/${selectedOrgId}/checkout-sessions`,
        {
          method: "POST",
          body: JSON.stringify({
            providerId,
            customerId,
            priceId,
            productId: productId || undefined,
            planId: planId || undefined,
            successUrl: successUrl || undefined,
            cancelUrl: cancelUrl || undefined,
          }),
        },
      );
      router.push(`/dashboard/checkout-sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create checkout session.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Create checkout session</h1>
        <p className="mt-1 text-sm text-slate-500">
          Start a hosted checkout for a customer against a provider and price.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {error ? <Alert variant="destructive">{error}</Alert> : null}

              <div>
                <Label htmlFor="providerId">Provider</Label>
                <Select
                  id="providerId"
                  required
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                >
                  <option value="">Select a provider</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} ({p.type})
                    </option>
                  ))}
                </Select>
              </div>

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
                <Label htmlFor="successUrl">Success URL</Label>
                <Input
                  id="successUrl"
                  type="url"
                  value={successUrl}
                  onChange={(e) => setSuccessUrl(e.target.value)}
                  placeholder="https://example.com/success"
                />
              </div>

              <div>
                <Label htmlFor="cancelUrl">Cancel URL</Label>
                <Input
                  id="cancelUrl"
                  type="url"
                  value={cancelUrl}
                  onChange={(e) => setCancelUrl(e.target.value)}
                  placeholder="https://example.com/cancel"
                />
              </div>

              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create checkout session"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function CreateCheckoutSessionPage() {
  return (
    <ProtectedRoute>
      <CreateCheckoutSessionContent />
    </ProtectedRoute>
  );
}
