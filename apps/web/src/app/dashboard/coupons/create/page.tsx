"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardContent, Input, Label, Select } from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import {
  COUPON_DISCOUNT_TYPES,
  COUPON_DURATIONS,
  type Coupon,
  type CouponDiscountType,
  type CouponDuration,
} from "../../../../lib/coupons-types";

function CreateCouponContent() {
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [discountType, setDiscountType] = useState<CouponDiscountType>("PERCENTAGE");
  const [percentOff, setPercentOff] = useState("");
  const [amountOffMinor, setAmountOffMinor] = useState("");
  const [currency, setCurrency] = useState("");
  const [duration, setDuration] = useState<CouponDuration>("ONCE");
  const [durationInCycles, setDurationInCycles] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) {
      setError("Select an organization first.");
      return;
    }

    setError(null);
    setCreating(true);
    try {
      const coupon = await authedFetch<Coupon>(`/organizations/${selectedOrgId}/coupons`, {
        method: "POST",
        body: JSON.stringify({
          code,
          name: name || undefined,
          discountType,
          percentOff: discountType === "PERCENTAGE" && percentOff ? Number(percentOff) : undefined,
          amountOffMinor:
            discountType === "FIXED" && amountOffMinor ? Number(amountOffMinor) : undefined,
          currency: discountType === "FIXED" && currency ? currency.toUpperCase() : undefined,
          duration,
          durationInCycles:
            duration === "REPEATING" && durationInCycles ? Number(durationInCycles) : undefined,
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      router.push(`/dashboard/coupons/${coupon.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create coupon.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Create coupon</h1>
        <p className="mt-1 text-sm text-slate-500">
          An internal discount definition. Redeemable promotion codes are added afterwards.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {error ? <Alert variant="destructive">{error}</Alert> : null}

              <div>
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  required
                  maxLength={64}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="SUMMER2026"
                />
              </div>

              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  maxLength={255}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div>
                <Label htmlFor="discountType">Discount type</Label>
                <Select
                  id="discountType"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as CouponDiscountType)}
                >
                  {COUPON_DISCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>

              {discountType === "PERCENTAGE" ? (
                <div>
                  <Label htmlFor="percentOff">Percent off</Label>
                  <Input
                    id="percentOff"
                    type="number"
                    min={1}
                    max={100}
                    value={percentOff}
                    onChange={(e) => setPercentOff(e.target.value)}
                    placeholder="20"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="amountOffMinor">Amount off (minor units, e.g. cents)</Label>
                    <Input
                      id="amountOffMinor"
                      type="number"
                      min={0}
                      value={amountOffMinor}
                      onChange={(e) => setAmountOffMinor(e.target.value)}
                      placeholder="500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Input
                      id="currency"
                      maxLength={3}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      placeholder="USD"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="duration">Duration</Label>
                <Select
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as CouponDuration)}
                >
                  {COUPON_DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>

              {duration === "REPEATING" ? (
                <div>
                  <Label htmlFor="durationInCycles">Duration in cycles</Label>
                  <Input
                    id="durationInCycles"
                    type="number"
                    min={1}
                    value={durationInCycles}
                    onChange={(e) => setDurationInCycles(e.target.value)}
                  />
                </div>
              ) : null}

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

              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create coupon"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function CreateCouponPage() {
  return (
    <ProtectedRoute>
      <CreateCouponContent />
    </ProtectedRoute>
  );
}
