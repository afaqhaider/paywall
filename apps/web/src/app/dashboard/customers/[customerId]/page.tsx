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
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import type { CursorResult } from "../../../../lib/cursor-types";
import { CUSTOMER_TYPES, type Customer, type CustomerType } from "../../../../lib/customers-types";
import { subscriptionStatusVariant, type Subscription } from "../../../../lib/subscriptions-types";

function CustomerDetailContent() {
  const { customerId } = useParams<{ customerId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<CustomerType>("INDIVIDUAL");
  const [saving, setSaving] = useState(false);

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<Customer>(
        `/organizations/${selectedOrgId}/customers/${customerId}`,
      );
      setCustomer(data);
      setDisplayName(data.displayName ?? "");
      setEmail(data.email ?? "");
      setType(data.type);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load customer.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, customerId]);

  const loadSubscriptions = useCallback(async () => {
    if (!selectedOrgId) return;
    setSubscriptionsLoading(true);
    try {
      const data = await authedFetch<CursorResult<Subscription>>(
        `/organizations/${selectedOrgId}/subscriptions?limit=100`,
      );
      setSubscriptions(data.items.filter((s) => s.customerId === customerId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load subscriptions.");
    } finally {
      setSubscriptionsLoading(false);
    }
  }, [authedFetch, selectedOrgId, customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setSaving(true);
    setActionMessage(null);
    try {
      const updated = await authedFetch<Customer>(
        `/organizations/${selectedOrgId}/customers/${customerId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            displayName: displayName || undefined,
            email: email || undefined,
            type,
          }),
        },
      );
      setCustomer(updated);
      setActionMessage("Customer updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/dashboard/customers" className="text-sm text-slate-500 hover:text-slate-900">
          ← Customers
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        {loading || !customer ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <h1 className="text-2xl font-semibold text-slate-900">
                {customer.displayName ?? customer.email ?? customer.id}
              </h1>
              <Badge variant="outline">{customer.type.toLowerCase()}</Badge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
                  <div>
                    <Label htmlFor="displayName">Display name</Label>
                    <Input
                      id="displayName"
                      maxLength={150}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
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
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                {subscriptionsLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : subscriptions.length === 0 ? (
                  <p className="text-sm text-slate-500">No subscriptions for this customer yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Period end</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <Badge variant={subscriptionStatusVariant(sub.status)}>
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{sub.quantity}</TableCell>
                          <TableCell>
                            {sub.currentPeriodEnd
                              ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/dashboard/subscriptions/${sub.id}`}
                              className="text-sm font-medium text-slate-700 hover:text-slate-900"
                            >
                              View →
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function CustomerDetailPage() {
  return (
    <ProtectedRoute>
      <CustomerDetailContent />
    </ProtectedRoute>
  );
}
