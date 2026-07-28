"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { ApiError } from "../../../../lib/api-client";
import type { CursorResult } from "../../../../lib/cursor-types";
import type {
  WebhookDeliveryDetail,
  WebhookDeliveryStatus,
  WebhookDeliverySummary,
  WebhookEndpoint,
} from "../../../../lib/webhooks-types";

const DELIVERY_STATUSES: WebhookDeliveryStatus[] = [
  "PENDING",
  "SUCCESS",
  "FAILED",
  "RETRYING",
  "EXHAUSTED",
];

function WebhookDetailContent() {
  const { webhookEndpointId } = useParams<{ webhookEndpointId: string }>();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId") ?? "";
  const { authedFetch } = useAuth();

  const [endpoint, setEndpoint] = useState<WebhookEndpoint | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliverySummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [selectedDelivery, setSelectedDelivery] = useState<WebhookDeliveryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadEndpoint = useCallback(async () => {
    if (!applicationId) return;
    try {
      const data = await authedFetch<WebhookEndpoint>(
        `/applications/${applicationId}/webhook-endpoints/${webhookEndpointId}`,
      );
      setEndpoint(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load webhook endpoint.");
    }
  }, [authedFetch, applicationId, webhookEndpointId]);

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (statusFilter) params.set("status", statusFilter);
      if (eventTypeFilter) params.set("eventType", eventTypeFilter);
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [statusFilter, eventTypeFilter],
  );

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<WebhookDeliverySummary>>(
        `/webhook-endpoints/${webhookEndpointId}/deliveries${buildQuery()}`,
      );
      setDeliveries(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load deliveries.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, webhookEndpointId, buildQuery]);

  useEffect(() => {
    void loadEndpoint();
  }, [loadEndpoint]);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedFetch<CursorResult<WebhookDeliverySummary>>(
        `/webhook-endpoints/${webhookEndpointId}/deliveries${buildQuery(nextCursor)}`,
      );
      setDeliveries((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more deliveries.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleSelectDelivery(deliveryId: string) {
    setDetailLoading(true);
    setActionMessage(null);
    try {
      const data = await authedFetch<WebhookDeliveryDetail>(
        `/webhook-endpoints/${webhookEndpointId}/deliveries/${deliveryId}`,
      );
      setSelectedDelivery(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load delivery detail.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleRetry(deliveryId: string) {
    setActionMessage(null);
    try {
      const updated = await authedFetch<WebhookDeliveryDetail>(
        `/webhook-endpoints/${webhookEndpointId}/deliveries/${deliveryId}/retry`,
        { method: "POST" },
      );
      setSelectedDelivery(updated);
      setActionMessage("Delivery retry queued.");
      await loadDeliveries();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not retry delivery.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/dashboard/webhooks" className="text-sm text-slate-500 hover:text-slate-900">
          ← Webhooks
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        {endpoint ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-slate-900">
                <span className="text-base font-semibold">{endpoint.url}</span>
                <Badge variant={endpoint.status === "ENABLED" ? "success" : "outline"}>
                  {endpoint.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {endpoint.description ? (
                <p className="text-sm text-slate-500">{endpoint.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {endpoint.eventTypes.map((eventType) => (
                  <Badge key={eventType} variant="outline">
                    {eventType}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Delivery history</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-3">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {DELIVERY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <input
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                placeholder="Filter by event type"
                className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : deliveries.length === 0 ? (
              <p className="text-sm text-slate-500">No deliveries yet.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Response</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((delivery) => (
                      <TableRow
                        key={delivery.id}
                        className="cursor-pointer"
                        onClick={() => void handleSelectDelivery(delivery.id)}
                      >
                        <TableCell className="font-mono text-xs">{delivery.eventType}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              delivery.status === "SUCCESS"
                                ? "success"
                                : delivery.status === "FAILED" || delivery.status === "EXHAUSTED"
                                  ? "destructive"
                                  : "outline"
                            }
                          >
                            {delivery.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{delivery.responseStatus ?? "—"}</TableCell>
                        <TableCell>{delivery.attemptCount}</TableCell>
                        <TableCell>{new Date(delivery.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {nextCursor ? (
                  <div className="mt-4 flex justify-center">
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

            {detailLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading delivery…</p>
            ) : null}

            {selectedDelivery ? (
              <div className="mt-6 rounded-md border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-slate-900">
                    {selectedDelivery.eventType}
                  </h3>
                  {selectedDelivery.status === "FAILED" ||
                  selectedDelivery.status === "EXHAUSTED" ? (
                    <Button size="sm" onClick={() => void handleRetry(selectedDelivery.id)}>
                      Retry
                    </Button>
                  ) : null}
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Payload
                  </p>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50">
                    {JSON.stringify(selectedDelivery.payload, null, 2)}
                  </pre>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Response body
                  </p>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50">
                    {selectedDelivery.responseBody ?? "(none)"}
                  </pre>
                </div>
                {selectedDelivery.retries.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Retries
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Response</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead>Executed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedDelivery.retries.map((retry) => (
                          <TableRow key={retry.id}>
                            <TableCell>{retry.attemptNumber}</TableCell>
                            <TableCell>{retry.responseStatus ?? "—"}</TableCell>
                            <TableCell>{retry.error ?? "—"}</TableCell>
                            <TableCell>{new Date(retry.executedAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function WebhookDetailPage() {
  return (
    <ProtectedRoute>
      <WebhookDetailContent />
    </ProtectedRoute>
  );
}
