"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardContent, Input, Label, Select, Textarea } from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import type { ApplicationListResult } from "../../../../lib/applications-types";
import {
  PRODUCT_VISIBILITIES,
  type Product,
  type ProductVisibility,
} from "../../../../lib/products-types";

function CreateProductContent() {
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();
  const router = useRouter();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ProductVisibility>("PRIVATE");
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
      const product = await authedFetch<Product>(`/organizations/${selectedOrgId}/products`, {
        method: "POST",
        body: JSON.stringify({
          applicationId,
          name,
          description: description || undefined,
          visibility,
        }),
      });
      router.push(`/dashboard/products/${product.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create product.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Create product</h1>
        <p className="mt-1 text-sm text-slate-500">
          Products belong to an application and hold one or more billing plans.
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
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  required
                  minLength={2}
                  maxLength={150}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pro Plan Bundle"
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

              <div>
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as ProductVisibility)}
                >
                  {PRODUCT_VISIBILITIES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              </div>

              <Button type="submit" disabled={creating || !applicationId}>
                {creating ? "Creating..." : "Create product"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function CreateProductPage() {
  return (
    <ProtectedRoute>
      <CreateProductContent />
    </ProtectedRoute>
  );
}
