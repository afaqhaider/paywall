"use client";

import React, { useCallback, useEffect, useState, type FormEvent } from "react";
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
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  deliveryStatusVariant,
  type NotificationCategory,
  type NotificationChannel,
  type PlatformNotification,
} from "../../../lib/admin-notifications-types";

export default function AdminNotificationsPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [category, setCategory] = useState<NotificationCategory>(NOTIFICATION_CATEGORIES[0]);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [correlationId, setCorrelationId] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<NotificationChannel[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, PlatformNotification>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PlatformNotification[]>("/admin/notifications");
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleChannel(channel: NotificationChannel) {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel],
    );
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    setSendError(null);

    let payload: Record<string, unknown>;
    try {
      payload = payloadText.trim() ? JSON.parse(payloadText) : {};
    } catch {
      setSendError("Payload must be valid JSON.");
      return;
    }

    setSending(true);
    setMessage(null);
    setError(null);
    try {
      await authedFetch("/admin/notifications", {
        method: "POST",
        body: JSON.stringify({
          category,
          recipientUserId: recipientUserId || undefined,
          organizationId: organizationId || undefined,
          customerId: customerId || undefined,
          payload,
          channels: selectedChannels.length > 0 ? selectedChannels : undefined,
          correlationId: correlationId || undefined,
        }),
      });
      setMessage("Notification sent.");
      setRecipientUserId("");
      setOrganizationId("");
      setCustomerId("");
      setPayloadText("{}");
      setCorrelationId("");
      setSelectedChannels([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send notification.");
    } finally {
      setSending(false);
    }
  }

  async function handleExpand(notificationId: string) {
    if (expandedId === notificationId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(notificationId);
    if (!details[notificationId]) {
      setDetailsLoading(true);
      try {
        const data = await authedFetch<PlatformNotification>(
          `/admin/notifications/${notificationId}`,
        );
        setDetails((prev) => ({ ...prev, [notificationId]: data }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load notification detail.");
      } finally {
        setDetailsLoading(false);
      }
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
      <p className="mt-1 text-sm text-slate-500">
        Sent platform notifications and delivery status.
      </p>

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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Send test notification</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="flex flex-col gap-4" noValidate>
            {sendError ? <Alert variant="destructive">{sendError}</Alert> : null}
            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as NotificationCategory)}
              >
                {NOTIFICATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="recipientUserId">Recipient user ID</Label>
                <Input
                  id="recipientUserId"
                  value={recipientUserId}
                  onChange={(e) => setRecipientUserId(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="organizationId">Organization ID</Label>
                <Input
                  id="organizationId"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="customerId">Customer ID</Label>
                <Input
                  id="customerId"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Channels (optional - defaults to the template&apos;s channel)</Label>
              <div className="mt-1 flex flex-wrap gap-3">
                {NOTIFICATION_CHANNELS.map((channel) => (
                  <label key={channel} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(channel)}
                      onChange={() => toggleChannel(channel)}
                    />
                    {channel}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="payload">Payload (JSON)</Label>
              <Textarea
                id="payload"
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="correlationId">Correlation ID (optional)</Label>
              <Input
                id="correlationId"
                value={correlationId}
                onChange={(e) => setCorrelationId(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send notification"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No notifications sent yet.</p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((notification) => {
              const detail = details[notification.id];
              const deliveries = detail?.deliveries ?? notification.deliveries;
              return (
                <React.Fragment key={notification.id}>
                  <TableRow>
                    <TableCell className="font-medium">{notification.category}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {notification.recipientUserId ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {notification.organizationId ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {notification.customerId ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(notification.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleExpand(notification.id)}
                      >
                        {expandedId === notification.id ? "Hide" : "Deliveries"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === notification.id ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="rounded bg-slate-50 p-4">
                          {detailsLoading && !detail ? (
                            <p className="text-xs text-slate-500">Loading deliveries…</p>
                          ) : !deliveries || deliveries.length === 0 ? (
                            <p className="text-xs text-slate-500">No deliveries recorded.</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Channel</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Attempts</TableHead>
                                  <TableHead>Error</TableHead>
                                  <TableHead>Sent</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {deliveries.map((d) => (
                                  <TableRow key={d.id}>
                                    <TableCell className="text-xs">{d.channel}</TableCell>
                                    <TableCell>
                                      <Badge variant={deliveryStatusVariant(d.status)}>
                                        {d.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{d.attemptCount}</TableCell>
                                    <TableCell className="text-xs">{d.error ?? "—"}</TableCell>
                                    <TableCell className="text-xs">
                                      {d.sentAt ? new Date(d.sentAt).toLocaleString() : "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
