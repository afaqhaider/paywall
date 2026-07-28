"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardContent, Input, Label, Select, Textarea } from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import {
  PAYMENT_ENVIRONMENT_MODES,
  PAYMENT_PROVIDER_TYPES,
  type PaymentEnvironmentMode,
  type PaymentProvider,
  type PaymentProviderType,
} from "../../../../lib/payments-types";

function CreatePaymentProviderContent() {
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();
  const router = useRouter();

  const [type, setType] = useState<PaymentProviderType>("STRIPE");
  const [displayName, setDisplayName] = useState("");
  const [environment, setEnvironment] = useState<PaymentEnvironmentMode>("SANDBOX");
  const [configText, setConfigText] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) {
      setError("Select an organization first.");
      return;
    }

    let config: Record<string, unknown> | undefined;
    if (configText.trim()) {
      try {
        config = JSON.parse(configText);
      } catch {
        setError("Config must be valid JSON.");
        return;
      }
    }

    setError(null);
    setCreating(true);
    try {
      const provider = await authedFetch<PaymentProvider>(
        `/organizations/${selectedOrgId}/payment-providers`,
        {
          method: "POST",
          body: JSON.stringify({
            type,
            displayName,
            environment,
            config,
          }),
        },
      );
      router.push(`/dashboard/payment-providers/${provider.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create payment provider.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Add payment provider</h1>
        <p className="mt-1 text-sm text-slate-500">
          Connect a payment provider for this organization. Credentials are added afterward from the
          provider&apos;s detail page.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {error ? <Alert variant="destructive">{error}</Alert> : null}

              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as PaymentProviderType)}
                >
                  {PAYMENT_PROVIDER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  required
                  maxLength={150}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Stripe (Production)"
                />
              </div>

              <div>
                <Label htmlFor="environment">Environment</Label>
                <Select
                  id="environment"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as PaymentEnvironmentMode)}
                >
                  {PAYMENT_ENVIRONMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="config">Config (JSON, optional)</Label>
                <Textarea
                  id="config"
                  value={configText}
                  onChange={(e) => setConfigText(e.target.value)}
                  placeholder='{"statementDescriptor": "SSZ"}'
                  rows={4}
                />
              </div>

              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Add provider"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function CreatePaymentProviderPage() {
  return (
    <ProtectedRoute>
      <CreatePaymentProviderContent />
    </ProtectedRoute>
  );
}
