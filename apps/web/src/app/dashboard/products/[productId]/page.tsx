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
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import type { CursorResult } from "../../../../lib/cursor-types";
import {
  PLAN_BILLING_TYPES,
  PRODUCT_VISIBILITIES,
  type Plan,
  type PlanBillingType,
  type Product,
  type ProductVisibility,
} from "../../../../lib/products-types";

function ProductDetailContent() {
  const { productId } = useParams<{ productId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ProductVisibility>("PRIVATE");
  const [saving, setSaving] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansNextCursor, setPlansNextCursor] = useState<string | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);

  const [planName, setPlanName] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [planBillingType, setPlanBillingType] = useState<PlanBillingType>("RECURRING");
  const [planTrialDays, setPlanTrialDays] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);

  const loadProduct = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<Product>(
        `/organizations/${selectedOrgId}/products/${productId}`,
      );
      setProduct(data);
      setName(data.name);
      setDescription(data.description ?? "");
      setVisibility(data.visibility);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load product.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, productId]);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const data = await authedFetch<CursorResult<Plan>>(`/products/${productId}/plans`);
      setPlans(data.items);
      setPlansNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load plans.");
    } finally {
      setPlansLoading(false);
    }
  }, [authedFetch, productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  async function handleLoadMorePlans() {
    if (!plansNextCursor) return;
    try {
      const data = await authedFetch<CursorResult<Plan>>(
        `/products/${productId}/plans?cursor=${encodeURIComponent(plansNextCursor)}`,
      );
      setPlans((prev) => [...prev, ...data.items]);
      setPlansNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more plans.");
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setSaving(true);
    setActionMessage(null);
    try {
      const updated = await authedFetch<Product>(
        `/organizations/${selectedOrgId}/products/${productId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name,
            description: description || undefined,
            visibility,
          }),
        },
      );
      setProduct(updated);
      setActionMessage("Product updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle() {
    if (!product || !selectedOrgId) return;
    setActionMessage(null);
    try {
      const action = product.status === "ARCHIVED" ? "restore" : "archive";
      const updated = await authedFetch<Product>(
        `/organizations/${selectedOrgId}/products/${productId}/${action}`,
        { method: "POST" },
      );
      setProduct(updated);
      setActionMessage(action === "archive" ? "Product archived." : "Product restored.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update product status.");
    }
  }

  async function handleCreatePlan(event: FormEvent) {
    event.preventDefault();
    setCreatingPlan(true);
    setError(null);
    try {
      await authedFetch(`/products/${productId}/plans`, {
        method: "POST",
        body: JSON.stringify({
          name: planName,
          code: planCode,
          billingType: planBillingType,
          trialEligible: planTrialDays !== "",
          trialDays: planTrialDays ? Number(planTrialDays) : undefined,
        }),
      });
      setPlanName("");
      setPlanCode("");
      setPlanTrialDays("");
      await loadPlans();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create plan.");
    } finally {
      setCreatingPlan(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/dashboard/products" className="text-sm text-slate-500 hover:text-slate-900">
          ← Products
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        {loading || !product ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
                <p className="mt-1 text-sm text-slate-500">/{product.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={product.status === "ACTIVE" ? "success" : "outline"}>
                  {product.status}
                </Badge>
                <Badge variant="outline">{product.visibility.toLowerCase()}</Badge>
              </div>
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
                      minLength={2}
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
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleArchiveToggle}>
                      {product.status === "ARCHIVED" ? "Restore product" : "Archive product"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Plans</CardTitle>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : plans.length === 0 ? (
                  <p className="text-sm text-slate-500">No plans yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Billing</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium text-slate-900">{plan.name}</TableCell>
                          <TableCell className="font-mono text-xs">{plan.code}</TableCell>
                          <TableCell>{plan.billingType}</TableCell>
                          <TableCell>
                            <Badge variant={plan.status === "ACTIVE" ? "success" : "outline"}>
                              {plan.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/dashboard/products/${productId}/plans/${plan.id}`}
                              className="text-sm font-medium text-slate-700 hover:text-slate-900"
                            >
                              Manage →
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {plansNextCursor ? (
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => void handleLoadMorePlans()}>
                      Load more
                    </Button>
                  </div>
                ) : null}

                <form
                  onSubmit={handleCreatePlan}
                  className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
                  noValidate
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <Label htmlFor="planName">Name</Label>
                      <Input
                        id="planName"
                        required
                        maxLength={150}
                        value={planName}
                        onChange={(e) => setPlanName(e.target.value)}
                        placeholder="Pro"
                      />
                    </div>
                    <div>
                      <Label htmlFor="planCode">Code</Label>
                      <Input
                        id="planCode"
                        required
                        maxLength={50}
                        value={planCode}
                        onChange={(e) => setPlanCode(e.target.value)}
                        placeholder="pro"
                      />
                    </div>
                    <div>
                      <Label htmlFor="planBillingType">Billing type</Label>
                      <Select
                        id="planBillingType"
                        value={planBillingType}
                        onChange={(e) => setPlanBillingType(e.target.value as PlanBillingType)}
                      >
                        {PLAN_BILLING_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="planTrialDays">Trial days</Label>
                      <Input
                        id="planTrialDays"
                        type="number"
                        min={1}
                        max={365}
                        value={planTrialDays}
                        onChange={(e) => setPlanTrialDays(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={creatingPlan}>
                    {creatingPlan ? "Creating..." : "Create plan"}
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

export default function ProductDetailPage() {
  return (
    <ProtectedRoute>
      <ProductDetailContent />
    </ProtectedRoute>
  );
}
