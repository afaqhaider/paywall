"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError, getAccessToken } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import type { AdminAuditLogEntry } from "../../../lib/admin-audit-types";

export default function AdminAuditCenterPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<AdminAuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [organizationId, setOrganizationId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (organizationId) params.set("organizationId", organizationId);
      if (applicationId) params.set("applicationId", applicationId);
      if (userId) params.set("userId", userId);
      if (action) params.set("action", action);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [organizationId, applicationId, userId, action, from, to],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<AdminAuditLogEntry>>(
        `/admin/audit-log${buildQuery()}`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load audit log.");
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
      const data = await authedFetch<CursorResult<AdminAuditLogEntry>>(
        `/admin/audit-log${buildQuery(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more audit log entries.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${apiUrl}/admin/audit-log/export${buildQuery()}`, {
        headers: getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : undefined,
        credentials: "include",
      });
      if (!res.ok) {
        throw new ApiError(res.status, await res.json().catch(() => undefined));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "audit-log.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not export audit log.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Audit Center</h1>
        <Button variant="outline" onClick={() => void handleExport()} disabled={exporting}>
          {exporting ? "Exporting..." : "Export to CSV"}
        </Button>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Platform-wide audit trail of admin and user actions.
      </p>

      <Card className="mt-4">
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          >
            <div>
              <Label htmlFor="organizationId">Organization ID</Label>
              <Input
                id="organizationId"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="applicationId">Application ID</Label>
              <Input
                id="applicationId"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="userId">User ID</Label>
              <Input id="userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="action">Action</Label>
              <Input id="action" value={action} onChange={(e) => setAction(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button type="submit" variant="outline" className="w-fit">
              Apply filters
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No audit log entries found.</p>
      ) : (
        <>
          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.action}</TableCell>
                  <TableCell className="text-xs">{e.actorEmail ?? e.actorUserId ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {e.targetType
                      ? `${e.targetType}:${e.targetId}`
                      : (e.organizationId ?? e.applicationId ?? e.userId ?? "—")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(e.createdAt).toLocaleString()}
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
    </main>
  );
}
