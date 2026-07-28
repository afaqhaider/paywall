"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, CardContent } from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { PortalNav } from "../../../components/portal-nav";
import { CustomerSwitcher } from "../../../components/customer-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useCustomer } from "../../../lib/customer-context";
import { ApiError } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import type { CustomerNotification } from "../../../lib/customer-portal-types";

function NotificationsContent() {
  const { authedFetch } = useAuth();
  const { customers, selectedCustomerId, selectCustomer } = useCustomer();
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (unreadOnly) params.set("unreadOnly", "true");
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [unreadOnly],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<CustomerNotification>>(
        `/customer-portal/me/notifications${buildQuery()}`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load notifications.");
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
      const data = await authedFetch<CursorResult<CustomerNotification>>(
        `/customer-portal/me/notifications${buildQuery(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more notifications.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleMarkRead(id: string) {
    setMarkingId(id);
    try {
      await authedFetch(`/customer-portal/me/notifications/${id}/read`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark notification as read.");
    } finally {
      setMarkingId(null);
    }
  }

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      await authedFetch("/customer-portal/me/notifications/read-all", { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark all as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <>
      <PortalNav>
        <CustomerSwitcher
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelect={selectCustomer}
        />
      </PortalNav>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <Button
            variant="outline"
            size="sm"
            disabled={markingAll}
            onClick={() => void handleMarkAll()}
          >
            {markingAll ? "Marking..." : "Mark all read"}
          </Button>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          Unread only
        </label>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No notifications.</p>
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-3">
              {items.map((n) => (
                <Card key={n.id} className={n.read ? "opacity-70" : undefined}>
                  <CardContent className="flex items-start justify-between gap-4 pt-6">
                    <div>
                      <div className="flex items-center gap-2">
                        {n.title ? <p className="font-medium text-slate-900">{n.title}</p> : null}
                        {!n.read ? <Badge variant="default">New</Badge> : null}
                        {n.type ? <Badge variant="outline">{n.type}</Badge> : null}
                      </div>
                      {n.message ? (
                        <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!n.read ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={markingId === n.id}
                        onClick={() => void handleMarkRead(n.id)}
                      >
                        Mark read
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
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
    </>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}
