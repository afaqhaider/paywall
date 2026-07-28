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
import type { Coupon, PromotionCode } from "../../../../lib/coupons-types";

function CouponDetailContent() {
  const { couponId } = useParams<{ couponId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  const [promotionCodes, setPromotionCodes] = useState<PromotionCode[]>([]);
  const [promotionCodesLoading, setPromotionCodesLoading] = useState(true);

  const [newCode, setNewCode] = useState("");
  const [newCodeMaxRedemptions, setNewCodeMaxRedemptions] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);

  const loadCoupon = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<Coupon>(`/organizations/${selectedOrgId}/coupons/${couponId}`);
      setCoupon(data);
      setMaxRedemptions(data.maxRedemptions ? String(data.maxRedemptions) : "");
      setExpiresAt(data.expiresAt ? data.expiresAt.slice(0, 10) : "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load coupon.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, couponId]);

  const loadPromotionCodes = useCallback(async () => {
    setPromotionCodesLoading(true);
    try {
      const data = await authedFetch<PromotionCode[]>(`/coupons/${couponId}/promotion-codes`);
      setPromotionCodes(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load promotion codes.");
    } finally {
      setPromotionCodesLoading(false);
    }
  }, [authedFetch, couponId]);

  useEffect(() => {
    void loadCoupon();
  }, [loadCoupon]);

  useEffect(() => {
    void loadPromotionCodes();
  }, [loadPromotionCodes]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setSaving(true);
    setActionMessage(null);
    try {
      const updated = await authedFetch<Coupon>(
        `/organizations/${selectedOrgId}/coupons/${couponId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          }),
        },
      );
      setCoupon(updated);
      setActionMessage("Coupon updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!selectedOrgId) return;
    setActionMessage(null);
    try {
      const updated = await authedFetch<Coupon>(
        `/organizations/${selectedOrgId}/coupons/${couponId}/archive`,
        { method: "POST" },
      );
      setCoupon(updated);
      setActionMessage("Coupon archived.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not archive coupon.");
    }
  }

  async function handleCreatePromotionCode(event: FormEvent) {
    event.preventDefault();
    setCreatingCode(true);
    setError(null);
    try {
      await authedFetch(`/coupons/${couponId}/promotion-codes`, {
        method: "POST",
        body: JSON.stringify({
          code: newCode,
          maxRedemptions: newCodeMaxRedemptions ? Number(newCodeMaxRedemptions) : undefined,
        }),
      });
      setNewCode("");
      setNewCodeMaxRedemptions("");
      await loadPromotionCodes();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create promotion code.");
    } finally {
      setCreatingCode(false);
    }
  }

  async function handleDeactivate(promotionCodeId: string) {
    try {
      await authedFetch(`/coupons/${couponId}/promotion-codes/${promotionCodeId}/deactivate`, {
        method: "POST",
      });
      await loadPromotionCodes();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not deactivate promotion code.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/dashboard/coupons" className="text-sm text-slate-500 hover:text-slate-900">
          ← Coupons
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        {loading || !coupon ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="font-mono text-2xl font-semibold text-slate-900">{coupon.code}</h1>
                <p className="mt-1 text-sm text-slate-500">{coupon.name ?? "No name"}</p>
              </div>
              <Badge variant={coupon.status === "ACTIVE" ? "success" : "outline"}>
                {coupon.status}
              </Badge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  <p>
                    <span className="text-slate-500">Discount:</span>{" "}
                    {coupon.discountType === "PERCENTAGE"
                      ? `${coupon.percentOff ?? 0}%`
                      : `${coupon.amountOffMinor ?? 0} minor units (${coupon.currency ?? "?"})`}
                  </p>
                  <p>
                    <span className="text-slate-500">Duration:</span> {coupon.duration}
                    {coupon.durationInCycles ? ` (${coupon.durationInCycles} cycles)` : ""}
                  </p>
                  <p>
                    <span className="text-slate-500">Redemptions:</span> {coupon.redemptionCount}
                    {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}
                  </p>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="maxRedemptions">Max redemptions</Label>
                      <Input
                        id="maxRedemptions"
                        type="number"
                        min={1}
                        value={maxRedemptions}
                        onChange={(e) => setMaxRedemptions(e.target.value)}
                        placeholder="Unlimited"
                      />
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
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                    {coupon.status !== "ARCHIVED" ? (
                      <Button type="button" variant="outline" onClick={handleArchive}>
                        Archive coupon
                      </Button>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Promotion codes</CardTitle>
              </CardHeader>
              <CardContent>
                {promotionCodesLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : promotionCodes.length === 0 ? (
                  <p className="text-sm text-slate-500">No promotion codes yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Redemptions</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {promotionCodes.map((pc) => (
                        <TableRow key={pc.id}>
                          <TableCell className="font-mono text-xs">{pc.code}</TableCell>
                          <TableCell>
                            <Badge variant={pc.active ? "success" : "outline"}>
                              {pc.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {pc.redemptionCount}
                            {pc.maxRedemptions ? ` / ${pc.maxRedemptions}` : ""}
                          </TableCell>
                          <TableCell>
                            {pc.expiresAt ? new Date(pc.expiresAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell>
                            {pc.active ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleDeactivate(pc.id)}
                              >
                                Deactivate
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <form
                  onSubmit={handleCreatePromotionCode}
                  className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
                  noValidate
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="newCode">Code</Label>
                      <Input
                        id="newCode"
                        required
                        maxLength={64}
                        value={newCode}
                        onChange={(e) => setNewCode(e.target.value)}
                        placeholder="WELCOME10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newCodeMaxRedemptions">Max redemptions</Label>
                      <Input
                        id="newCodeMaxRedemptions"
                        type="number"
                        min={1}
                        value={newCodeMaxRedemptions}
                        onChange={(e) => setNewCodeMaxRedemptions(e.target.value)}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={creatingCode} className="w-fit">
                    {creatingCode ? "Creating..." : "Create promotion code"}
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

export default function CouponDetailPage() {
  return (
    <ProtectedRoute>
      <CouponDetailContent />
    </ProtectedRoute>
  );
}
