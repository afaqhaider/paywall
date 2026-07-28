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
import { LICENSE_TYPES, type License, type LicenseType } from "../../../../lib/licenses-types";

function CreateLicenseContent() {
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();
  const router = useRouter();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [type, setType] = useState<LicenseType>("INDIVIDUAL");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [seatLimit, setSeatLimit] = useState("");
  const [deviceLimit, setDeviceLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const data = await authedFetch<ApplicationListResult>(
        `/organizations/${selectedOrgId}/applications`,
      );
      setApplications(data);
      const firstId = data.items[0]?.id;
      if (firstId) {
        setApplicationId((current) => current || firstId);
      }
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
    if (!applicationId) {
      setError("Select an application first.");
      return;
    }

    setError(null);
    setCreating(true);
    try {
      const license = await authedFetch<License>(`/organizations/${selectedOrgId}/licenses`, {
        method: "POST",
        body: JSON.stringify({
          applicationId,
          type,
          subscriptionId: subscriptionId || undefined,
          seatLimit: seatLimit ? Number(seatLimit) : undefined,
          deviceLimit: deviceLimit ? Number(deviceLimit) : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      router.push(`/dashboard/licenses/${license.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create license.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Create license</h1>
        <p className="mt-1 text-sm text-slate-500">
          Issue a new license under an application. Seat and device limits are optional ceilings -
          leave them blank for unlimited.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {error ? <Alert variant="destructive">{error}</Alert> : null}

              <div>
                <Label htmlFor="applicationId">Application</Label>
                {applications && applications.items.length > 0 ? (
                  <Select
                    id="applicationId"
                    required
                    value={applicationId}
                    onChange={(e) => setApplicationId(e.target.value)}
                  >
                    {applications.items.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.displayName ?? app.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-sm text-slate-500">No applications yet - create one first.</p>
                )}
              </div>

              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as LicenseType)}
                >
                  {LICENSE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="subscriptionId">Subscription ID</Label>
                <Input
                  id="subscriptionId"
                  value={subscriptionId}
                  onChange={(e) => setSubscriptionId(e.target.value)}
                  placeholder="Optional - links this license to a subscription"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <Label htmlFor="deviceLimit">Device limit</Label>
                  <Input
                    id="deviceLimit"
                    type="number"
                    min={1}
                    value={deviceLimit}
                    onChange={(e) => setDeviceLimit(e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="expiresAt">Expires at</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>

              <Button type="submit" disabled={creating || !applicationId}>
                {creating ? "Creating..." : "Create license"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function CreateLicensePage() {
  return (
    <ProtectedRoute>
      <CreateLicenseContent />
    </ProtectedRoute>
  );
}
