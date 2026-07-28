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
  type NotificationCategory,
  type NotificationChannel,
  type NotificationTemplate,
} from "../../../lib/admin-notifications-types";

export default function AdminNotificationTemplatesPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [filterCategory, setFilterCategory] = useState("");
  const [filterChannel, setFilterChannel] = useState("");

  const [key, setKey] = useState("");
  const [category, setCategory] = useState<NotificationCategory>(NOTIFICATION_CATEGORIES[0]);
  const [channel, setChannel] = useState<NotificationChannel>(NOTIFICATION_CHANNELS[0]);
  const [subject, setSubject] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (filterCategory) params.set("category", filterCategory);
    if (filterChannel) params.set("channel", filterChannel);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [filterCategory, filterChannel]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<NotificationTemplate[]>(
        `/admin/notification-templates${buildQuery()}`,
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load notification templates.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    setError(null);
    try {
      await authedFetch("/admin/notification-templates", {
        method: "POST",
        body: JSON.stringify({
          key,
          category,
          channel,
          subject: subject || undefined,
          bodyTemplate,
          isActive,
        }),
      });
      setMessage("Notification template created.");
      setKey("");
      setSubject("");
      setBodyTemplate("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create notification template.");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(template: NotificationTemplate) {
    setEditingId(template.id);
    setEditSubject(template.subject ?? "");
    setEditBody(template.bodyTemplate);
    setEditActive(template.isActive);
  }

  async function handleSaveEdit(templateId: string) {
    setSavingEdit(true);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`/admin/notification-templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({
          subject: editSubject || undefined,
          bodyTemplate: editBody,
          isActive: editActive,
        }),
      });
      setMessage("Notification template updated.");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update notification template.");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Notification templates</h1>
      <p className="mt-1 text-sm text-slate-500">
        Templates used for outgoing notifications. Use {"{{variable}}"} placeholders in the body.
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
          <CardTitle>Create a template</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4" noValidate>
            <div>
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                required
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="subscription-renewed-email"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div>
                <Label htmlFor="channel">Channel</Label>
                <Select
                  id="channel"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as NotificationChannel)}
                >
                  {NOTIFICATION_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="subject">Subject (optional)</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bodyTemplate">Body template</Label>
              <Textarea
                id="bodyTemplate"
                required
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
                rows={5}
                placeholder="Hi {{firstName}}, your subscription has renewed…"
              />
              <p className="mt-1 text-xs text-slate-500">
                Supports {"{{variable}}"} placeholders substituted at send time.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create template"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="mt-6 flex flex-wrap items-end gap-3"
      >
        <div>
          <Label htmlFor="filterCategory">Category</Label>
          <Select
            id="filterCategory"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-56"
          >
            <option value="">All categories</option>
            {NOTIFICATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="filterChannel">Channel</Label>
          <Select
            id="filterChannel"
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="w-40"
          >
            <option value="">All channels</option>
            {NOTIFICATION_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No notification templates found.</p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((template) => (
              <React.Fragment key={template.id}>
                <TableRow>
                  <TableCell className="font-medium">{template.key}</TableCell>
                  <TableCell className="text-xs">{template.category}</TableCell>
                  <TableCell className="text-xs">{template.channel}</TableCell>
                  <TableCell>
                    <Badge variant={template.isActive ? "success" : "outline"}>
                      {template.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        editingId === template.id ? setEditingId(null) : startEdit(template)
                      }
                    >
                      {editingId === template.id ? "Cancel" : "Edit"}
                    </Button>
                  </TableCell>
                </TableRow>
                {editingId === template.id ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="flex flex-col gap-3 rounded bg-slate-50 p-4">
                        <div>
                          <Label htmlFor={`edit-subject-${template.id}`}>Subject</Label>
                          <Input
                            id={`edit-subject-${template.id}`}
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-body-${template.id}`}>Body template</Label>
                          <Textarea
                            id={`edit-body-${template.id}`}
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            rows={4}
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => setEditActive(e.target.checked)}
                          />
                          Active
                        </label>
                        <div>
                          <Button
                            size="sm"
                            disabled={savingEdit}
                            onClick={() => void handleSaveEdit(template.id)}
                          >
                            {savingEdit ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
