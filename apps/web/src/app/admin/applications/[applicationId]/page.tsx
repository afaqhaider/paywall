"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { useAuth } from "../../../../lib/auth-context";
import { ApiError } from "../../../../lib/api-client";
import {
  adminApplicationStatusVariant,
  type AdminApplicationDetail,
} from "../../../../lib/admin-applications-types";

export default function AdminApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();

  const [app, setApp] = useState<AdminApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [targetOrgId, setTargetOrgId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<AdminApplicationDetail>(
        `/admin/applications/${applicationId}`,
      );
      setApp(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load application.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: string, fn: () => Promise<void>) {
    setActionBusy(action);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(`${action} succeeded.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${action.toLowerCase()}.`);
    } finally {
      setActionBusy(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!app) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <p className="mt-4 text-sm text-slate-500">Application not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin/applications" className="text-sm text-slate-500 underline">
        Back to Applications
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{app.name}</h1>
        <Badge variant={adminApplicationStatusVariant(app.status)}>{app.status}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        /{app.slug} &middot; Org:{" "}
        <Link href={`/admin/organizations/${app.organizationId}`} className="underline">
          {app.organizationName}
        </Link>
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
          <CardTitle>Application Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={actionBusy !== null}
            onClick={() =>
              runAction("Suspend", async () => {
                await authedFetch(`/admin/applications/${applicationId}/suspend`, {
                  method: "POST",
                });
              })
            }
          >
            Suspend
          </Button>
          <Button
            variant="outline"
            disabled={actionBusy !== null}
            onClick={() =>
              runAction("Restore", async () => {
                await authedFetch(`/admin/applications/${applicationId}/restore`, {
                  method: "POST",
                });
              })
            }
          >
            Restore
          </Button>
          <Button
            variant="outline"
            disabled={actionBusy !== null}
            onClick={() =>
              runAction("Archive", async () => {
                await authedFetch(`/admin/applications/${applicationId}/archive`, {
                  method: "POST",
                });
              })
            }
          >
            Archive
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Move to a different organization</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runAction("Move", async () => {
                await authedFetch(`/admin/applications/${applicationId}/move`, {
                  method: "POST",
                  body: JSON.stringify({ targetOrganizationId: targetOrgId }),
                });
                setTargetOrgId("");
              });
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div>
              <Label htmlFor="targetOrgId">Target organization ID</Label>
              <Input
                id="targetOrgId"
                value={targetOrgId}
                onChange={(e) => setTargetOrgId(e.target.value)}
                className="w-72"
              />
            </div>
            <Button type="submit" disabled={actionBusy !== null || !targetOrgId}>
              Move
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Versions ({app.versions?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!app.versions || app.versions.length === 0 ? (
            <p className="text-sm text-slate-500">No versions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Track</TableHead>
                  <TableHead>Web</TableHead>
                  <TableHead>iOS</TableHead>
                  <TableHead>Android</TableHead>
                  <TableHead>Latest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {app.versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{v.track}</TableCell>
                    <TableCell>{v.webVersion ?? "—"}</TableCell>
                    <TableCell>{v.iosVersion ?? "—"}</TableCell>
                    <TableCell>{v.androidVersion ?? "—"}</TableCell>
                    <TableCell>
                      {v.isLatest ? <Badge variant="success">latest</Badge> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Environments ({app.environments?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!app.environments || app.environments.length === 0 ? (
            <p className="text-sm text-slate-500">No environments.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Base URL</TableHead>
                  <TableHead>API URL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {app.environments.map((env) => (
                  <TableRow key={env.id}>
                    <TableCell>{env.type}</TableCell>
                    <TableCell className="font-mono text-xs">{env.baseUrl ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{env.apiUrl ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>API Keys ({app.apiKeys?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!app.apiKeys || app.apiKeys.length === 0 ? (
            <p className="text-sm text-slate-500">No API keys.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>Revoked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {app.apiKeys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>{k.name}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {k.keyPrefix}…{k.lastFour}
                    </TableCell>
                    <TableCell>
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>{k.revokedAt ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Webhooks ({app.webhooks?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!app.webhooks || app.webhooks.length === 0 ? (
            <p className="text-sm text-slate-500">No webhook endpoints.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Events</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {app.webhooks.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.url}</TableCell>
                    <TableCell>
                      <Badge variant={w.status === "ENABLED" ? "success" : "outline"}>
                        {w.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{w.eventTypes?.join(", ") ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Secrets ({app.secrets?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!app.secrets || app.secrets.length === 0 ? (
            <p className="text-sm text-slate-500">
              No secrets. Metadata only - no plaintext ever shown.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last four</TableHead>
                  <TableHead>Rotated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {app.secrets.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.key}</TableCell>
                    <TableCell>{s.type}</TableCell>
                    <TableCell className="font-mono text-xs">{s.lastFour ?? "—"}</TableCell>
                    <TableCell>
                      {s.rotatedAt ? new Date(s.rotatedAt).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
