"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, CardContent, Label, Select } from "@paywall/ui";
import { PLATFORM_NAME } from "@paywall/shared";
import { apiFetch, ApiError } from "../../../lib/api-client";
import {
  formatPrice,
  providerLabel,
  type CheckoutIntentProvider,
  type GetCheckoutIntentResponse,
} from "../../../lib/checkout-intent-types";

/**
 * Hosted checkout page for the "developer embed" front (merge plan
 * checkpoint 6) - a third-party app calls `POST /public/checkout-intents`
 * with its API key, then opens this page (no auth) for its user to pick a
 * payment provider and pay. `PaymentCheckoutSession` requires a provider to
 * already be chosen, so this page's whole job is presenting that choice
 * before handing off to the provider's own real checkout URL.
 */
export default function EmbeddedCheckoutPage() {
  const { intentId } = useParams<{ intentId: string }>();

  const [data, setData] = useState<GetCheckoutIntentResponse | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<GetCheckoutIntentResponse>(`/checkout-intents/${intentId}`);
      setData(result);
      const firstProvider = result.providers[0];
      if (firstProvider) {
        setSelectedProviderId(firstProvider.id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This checkout link is invalid or expired.");
    } finally {
      setLoading(false);
    }
  }, [intentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePay() {
    if (!selectedProviderId) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await apiFetch<{ checkoutUrl: string }>(
        `/checkout-intents/${intentId}/complete`,
        { method: "POST", body: JSON.stringify({ providerId: selectedProviderId }) },
      );
      window.location.href = session.checkoutUrl;
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not start checkout with that provider.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
        {PLATFORM_NAME} Checkout
      </p>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {loading ? (
        <p className="text-center text-sm text-slate-500">Loading…</p>
      ) : data ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                {data.intent.plan.product.name}
              </h1>
              <p className="text-sm text-slate-600">{data.intent.plan.name}</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {formatPrice(data.intent.price)}
              </p>
            </div>

            {data.providers.length === 0 ? (
              <Alert variant="destructive">
                No payment methods are available for this purchase yet.
              </Alert>
            ) : (
              <>
                <div>
                  <Label htmlFor="provider">Pay with</Label>
                  <Select
                    id="provider"
                    value={selectedProviderId}
                    onChange={(e) => setSelectedProviderId(e.target.value)}
                  >
                    {data.providers.map((provider: CheckoutIntentProvider) => (
                      <option key={provider.id} value={provider.id}>
                        {providerLabel(provider)}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button disabled={submitting} onClick={() => void handlePay()}>
                  {submitting ? "Redirecting…" : "Continue to payment"}
                </Button>
              </>
            )}

            <p className="text-center text-xs text-slate-400">{data.intent.customerEmail}</p>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
