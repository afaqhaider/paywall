"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
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
import {
  PLATFORM_EVENT_TYPES,
  PLATFORM_EVENT_STATUSES,
  eventStatusVariant,
  type PlatformEvent,
} from "../../../lib/admin-events-types";

export default function AdminEventsPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<PlatformEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [correlationId, setCorrelationId] = useState("");

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      if (organizationId) params.set("organizationId", organizationId);
      if (applicationId) params.set("applicationId", applicationId);
      if (customerId) params.set("customerId", customerId);
      if (correlationId) params.set("correlationId", correlationId);
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [type, status, organizationId, applicationId, customerId, correlationId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<PlatformEvent>>(`/admin/events${buildQuery()}`);
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load events.");
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
      const data = await authedFetch<CursorResult<PlatformEvent>>(
        `/admin/events${buildQuery(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more events.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Events</h1>
      <p className="mt-1 text-sm text-slate-500">Platform event history and audit trail.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <Label htmlFor="type">Type</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value)} className="w-56">
            <option value="">All types</option>
            {PLATFORM_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-40"
          >
            <option value="">All statuses</option>
            {PLATFORM_EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="organizationId">Organization ID</Label>
          <Input
            id="organizationId"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label htmlFor="applicationId">Application ID</Label>
          <Input
            id="applicationId"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label htmlFor="customerId">Customer ID</Label>
          <Input
            id="customerId"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label htmlFor="correlationId">Correlation ID</Label>
          <Input
            id="correlationId"
            value={correlationId}
            onChange={(e) => setCorrelationId(e.target.value)}
            className="w-40"
          />
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

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No events found.</p>
      ) : (
        <>
          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <Link href={`/admin/events/${event.id}`} className="font-medium underline">
                      {event.type}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={eventStatusVariant(event.status)}>{event.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{event.organizationId ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{event.applicationId ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{event.customerId ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(event.createdAt).toLocaleString()}
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
