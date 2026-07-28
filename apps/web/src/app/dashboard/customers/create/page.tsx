"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardContent, Input, Label, Select } from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import type { ApplicationListResult } from "../../../../lib/applications-types";
import { CUSTOMER_TYPES, type Customer, type CustomerType } from "../../../../lib/customers-types";

function CreateCustomerContent() {
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();
  const router = useRouter();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [type, setType] = useState<CustomerType>("INDIVIDUAL");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const data = await authedFetch<ApplicationListResult>(
        `/organizations/${selectedOrgId}/applications`,
      );
      setApplications(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applications.");
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) {
      setError("Select an organization first.");
      return;
    }

    setError(null);
    setCreating(true);
    try {
      const customer = await authedFetch<Customer>(`/organizations/${selectedOrgId}/customers`, {
        method: "POST",
        body: JSON.stringify({
          applicationId: applicationId || undefined,
          type,
          displayName: displayName || undefined,
          email: email || undefined,
        }),
      });
      router.push(`/dashboard/customers/${customer.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create customer.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Create customer</h1>
        <p className="mt-1 text-sm text-slate-500">
          A platform-level customer identity that subscriptions attach to.
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
                  onChange={(e) => setType(e.target.value as CustomerType)}
                >
                  {CUSTOMER_TYPES.map((t) => (
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
                  maxLength={150}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>

              <div>
                <Label htmlFor="applicationId">Application (optional)</Label>
                <Select
                  id="applicationId"
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value)}
                >
                  <option value="">None</option>
                  {applications?.items.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.displayName ?? app.name}
                    </option>
                  ))}
                </Select>
              </div>

              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create customer"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function CreateCustomerPage() {
  return (
    <ProtectedRoute>
      <CreateCustomerContent />
    </ProtectedRoute>
  );
}
