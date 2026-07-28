"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import { subscriptionStatusVariant } from "../../../lib/subscriptions-types";
import {
  ADMIN_SUBSCRIPTION_STATUS_FILTERS,
  type AdminSubscriptionListItem,
} from "../../../lib/admin-subscriptions-types";

export default function AdminSubscriptionsPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<AdminSubscriptionListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [newPlanId, setNewPlanId] = useState("");
  const [trialDays, setTrialDays] = useState("7");
  const [renewalDate, setRenewalDate] = useState("");

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [search, statusFilter],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<AdminSubscriptionListItem>>(
        `/admin/subscriptions${buildQuery()}`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedFetch<CursorResult<AdminSubscriptionListItem>>(
        `/admin/subscriptions${buildQuery(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more subscriptions.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function runAction(action: string, path: string, body?: Record<string, unknown>) {
    setActionBusy(action);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      setMessage(`${action} succeeded.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${action.toLowerCase()}.`);
    } finally {
      setActionBusy(null);
    }
  }

  const selected = items.find((s) => s.id === selectedId) ?? null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Subscriptions</h1>
      <p className="mt-1 text-sm text-slate-500">All subscriptions across every organization.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <Label htmlFor="search">Search</Label>
          <Input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Customer, org, plan…"
            className="w-64"
          />
        </div>
        <div>
          <Label htmlFor="statusFilter">Status</Label>
          <Select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48"
          >
            {ADMIN_SUBSCRIPTION_STATUS_FILTERS.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "All statuses"}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" className="mt-4">
          {message}
        </Alert>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No subscriptions found.</p>
      ) : (
        <>
          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Period end</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.id}</TableCell>
                  <TableCell>
                    <Badge variant={subscriptionStatusVariant(s.status)}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.organizationName ?? s.organizationId}
                  </TableCell>
                  <TableCell className="text-xs">{s.customerEmail ?? s.customerId}</TableCell>
                  <TableCell className="text-xs">
                    {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setSelectedId(s.id)}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {nextCursor ? (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {selected ? (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>
              Manage subscription <span className="font-mono text-sm">{selected.id}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={actionBusy !== null}
                onClick={() =>
                  void runAction(
                    "Grant complimentary",
                    `/admin/subscriptions/${selected.id}/grant-complimentary`,
                  )
                }
              >
                Grant complimentary
              </Button>
              <Button
                variant="outline"
                disabled={actionBusy !== null}
                onClick={() =>
                  void runAction("Cancel", `/admin/subscriptions/${selected.id}/cancel`)
                }
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                disabled={actionBusy !== null}
                onClick={() => void runAction("Pause", `/admin/subscriptions/${selected.id}/pause`)}
              >
                Pause
              </Button>
              <Button
                variant="outline"
                disabled={actionBusy !== null}
                onClick={() =>
                  void runAction("Resume", `/admin/subscriptions/${selected.id}/resume`)
                }
              >
                Resume
              </Button>
              <Button
                variant="outline"
                disabled={actionBusy !== null}
                onClick={() => void runAction("Renew", `/admin/subscriptions/${selected.id}/renew`)}
              >
                Renew
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
              <div>
                <Label htmlFor="trialDays">Extend trial by (days)</Label>
                <Input
                  id="trialDays"
                  type="number"
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button
                variant="outline"
                disabled={actionBusy !== null}
                onClick={() =>
                  void runAction(
                    "Extend trial",
                    `/admin/subscriptions/${selected.id}/extend-trial`,
                    { days: Number(trialDays) },
                  )
                }
              >
                Extend trial
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
              <div>
                <Label htmlFor="renewalDate">New renewal date</Label>
                <Input
                  id="renewalDate"
                  type="date"
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                disabled={actionBusy !== null || !renewalDate}
                onClick={() =>
                  void runAction(
                    "Adjust renewal date",
                    `/admin/subscriptions/${selected.id}/adjust-renewal-date`,
                    { renewalDate },
                  )
                }
              >
                Adjust renewal date
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
              <div>
                <Label htmlFor="newPlanId">New plan ID</Label>
                <Input
                  id="newPlanId"
                  value={newPlanId}
                  onChange={(e) => setNewPlanId(e.target.value)}
                  className="w-64"
                />
              </div>
              <Button
                variant="outline"
                disabled={actionBusy !== null || !newPlanId}
                onClick={() =>
                  void runAction("Change plan", `/admin/subscriptions/${selected.id}/change-plan`, {
                    planId: newPlanId,
                  })
                }
              >
                Change plan
              </Button>
            </div>

            <Button variant="ghost" className="w-fit" onClick={() => setSelectedId(null)}>
              Close
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
