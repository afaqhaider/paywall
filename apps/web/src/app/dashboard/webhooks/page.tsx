"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
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
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { CopyableSecret } from "../../../components/copyable-secret";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type {
  ApplicationListResult,
  ApplicationEnvironment,
} from "../../../lib/applications-types";
import { WEBHOOK_EVENT_TYPES, type WebhookEndpoint } from "../../../lib/webhooks-types";

function WebhooksContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [environments, setEnvironments] = useState<ApplicationEnvironment[]>([]);

  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const loadApplications = useCallback(async () => {
    if (!selectedOrgId) {
      setApplications(null);
      setApplicationId("");
      return;
    }
    try {
      const data = await authedFetch<ApplicationListResult>(
        `/organizations/${selectedOrgId}/applications`,
      );
      setApplications(data);
      setApplicationId((current) =>
        current && data.items.some((a) => a.id === current) ? current : (data.items[0]?.id ?? ""),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applications.");
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const loadEnvironments = useCallback(async () => {
    if (!applicationId) {
      setEnvironments([]);
      return;
    }
    try {
      const data = await authedFetch<ApplicationEnvironment[]>(
        `/applications/${applicationId}/environments`,
      );
      setEnvironments(data);
    } catch {
      setEnvironments([]);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void loadEnvironments();
  }, [loadEnvironments]);

  const loadEndpoints = useCallback(async () => {
    if (!applicationId) {
      setEndpoints([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<WebhookEndpoint[]>(
        `/applications/${applicationId}/webhook-endpoints`,
      );
      setEndpoints(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load webhook endpoints.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void loadEndpoints();
  }, [loadEndpoints]);

  function toggleEvent(eventType: string) {
    setSelectedEvents((prev) =>
      prev.includes(eventType) ? prev.filter((e) => e !== eventType) : [...prev, eventType],
    );
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!applicationId || selectedEvents.length === 0) return;
    setCreating(true);
    setError(null);
    setCreatedSecret(null);
    try {
      const created = await authedFetch<WebhookEndpoint & { secret: { plainText: string } }>(
        `/applications/${applicationId}/webhook-endpoints`,
        {
          method: "POST",
          body: JSON.stringify({
            url,
            description: description || undefined,
            eventTypes: selectedEvents,
            environmentId: environmentId || undefined,
          }),
        },
      );
      setCreatedSecret(created.secret.plainText);
      setUrl("");
      setDescription("");
      setSelectedEvents([]);
      await loadEndpoints();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create webhook endpoint.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(endpoint: WebhookEndpoint) {
    setActionMessage(null);
    try {
      await authedFetch(
        `/applications/${applicationId}/webhook-endpoints/${endpoint.id}/${endpoint.status === "ENABLED" ? "disable" : "enable"}`,
        { method: "POST" },
      );
      await loadEndpoints();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update webhook endpoint.");
    }
  }

  async function handleDelete(endpointId: string) {
    setActionMessage(null);
    try {
      await authedFetch(`/applications/${applicationId}/webhook-endpoints/${endpointId}`, {
        method: "DELETE",
      });
      await loadEndpoints();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete webhook endpoint.");
    }
  }

  async function handleRotate(endpointId: string) {
    setActionMessage(null);
    setCreatedSecret(null);
    try {
      const secret = await authedFetch<{ plainText: string }>(
        `/applications/${applicationId}/webhook-endpoints/${endpointId}/secret/rotate`,
        { method: "POST" },
      );
      setCreatedSecret(secret.plainText);
      await loadEndpoints();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rotate signing secret.");
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
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Webhooks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Outbound event delivery endpoints for{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>.
        </p>

        <div className="mt-4 max-w-xs">
          <Label htmlFor="applicationFilter">Application</Label>
          {applications && applications.items.length > 0 ? (
            <Select
              id="applicationFilter"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
            >
              {applications.items.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.displayName ?? app.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-slate-500">No applications yet.</p>
          )}
        </div>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            {createdSecret ? (
              <Alert className="mb-4">
                <p className="font-medium">
                  Signing secret - copy it now, it will not be shown again.
                </p>
                <div className="mt-2">
                  <CopyableSecret value={createdSecret} />
                </div>
              </Alert>
            ) : null}

            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : endpoints.length === 0 ? (
              <p className="text-sm text-slate-500">No webhook endpoints yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {endpoints.map((endpoint) => (
                    <TableRow key={endpoint.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/webhooks/${endpoint.id}?applicationId=${applicationId}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {endpoint.url}
                        </Link>
                        {endpoint.description ? (
                          <p className="text-xs text-slate-500">{endpoint.description}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {endpoint.eventTypes.slice(0, 3).map((eventType) => (
                            <Badge key={eventType} variant="outline">
                              {eventType}
                            </Badge>
                          ))}
                          {endpoint.eventTypes.length > 3 ? (
                            <Badge variant="outline">+{endpoint.eventTypes.length - 3}</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={endpoint.status === "ENABLED" ? "success" : "outline"}>
                          {endpoint.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleStatus(endpoint)}
                          >
                            {endpoint.status === "ENABLED" ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRotate(endpoint.id)}
                          >
                            Rotate secret
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(endpoint.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <form
              onSubmit={handleCreate}
              className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
              noValidate
            >
              <h3 className="text-sm font-medium text-slate-700">Add endpoint</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="webhookUrl">URL</Label>
                  <Input
                    id="webhookUrl"
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/webhooks/ssz"
                  />
                </div>
                <div>
                  <Label htmlFor="webhookEnvironment">Environment (optional)</Label>
                  <Select
                    id="webhookEnvironment"
                    value={environmentId}
                    onChange={(e) => setEnvironmentId(e.target.value)}
                  >
                    <option value="">All environments</option>
                    {environments.map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.type}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="webhookDescription">Description (optional)</Label>
                <Input
                  id="webhookDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <Label>Event types</Label>
                <div className="mt-1 flex flex-wrap gap-3">
                  {WEBHOOK_EVENT_TYPES.map((eventType) => (
                    <label
                      key={eventType}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(eventType)}
                        onChange={() => toggleEvent(eventType)}
                      />
                      {eventType}
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={creating || !url || selectedEvents.length === 0}>
                {creating ? "Creating..." : "Create endpoint"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function WebhooksPage() {
  return (
    <ProtectedRoute>
      <WebhooksContent />
    </ProtectedRoute>
  );
}
