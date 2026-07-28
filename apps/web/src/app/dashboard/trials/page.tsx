"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import type { Trial } from "../../../lib/subscriptions-types";

function trialStatusVariant(
  status: Trial["status"],
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "CONVERTED":
      return "default";
    case "CANCELED":
    case "EXPIRED":
      return "destructive";
    default:
      return "outline";
  }
}

function TrialsListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();
  const [items, setItems] = useState<Trial[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) {
      setItems([]);
      setNextCursor(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<Trial>>(`/organizations/${selectedOrgId}/trials`);
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load trials.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!selectedOrgId || !nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedFetch<CursorResult<Trial>>(
        `/organizations/${selectedOrgId}/trials?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more trials.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <DashboardNav>
        <OrgSwitcher
          organizations={organizations}
          selectedOrgId={selectedOrgId}
          onSelect={selectOrg}
        />
      </DashboardNav>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Trials</h1>
        <p className="mt-1 text-sm text-slate-500">
          Trials started for{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>. Trials
          are created implicitly when a subscription starts with trial enabled.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <Card className="mt-6">
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">No trials yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ends</TableHead>
                    <TableHead>Converted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((trial) => (
                    <TableRow key={trial.id}>
                      <TableCell>
                        <Badge variant={trialStatusVariant(trial.status)}>{trial.status}</Badge>
                      </TableCell>
                      <TableCell>{new Date(trial.startedAt).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(trial.endsAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {trial.convertedAt ? new Date(trial.convertedAt).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {nextCursor ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function TrialsListPage() {
  return (
    <ProtectedRoute>
      <TrialsListContent />
    </ProtectedRoute>
  );
}
