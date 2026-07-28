"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  adminOrganizationStatusVariant,
  type AdminOrganizationDetail,
} from "../../../../lib/admin-organizations-types";

export default function AdminOrganizationDetailPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { authedFetch } = useAuth();
  const router = useRouter();

  const [org, setOrg] = useState<AdminOrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [newOwnerUserId, setNewOwnerUserId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<AdminOrganizationDetail>(
        `/admin/organizations/${organizationId}`,
      );
      setOrg(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load organization.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, organizationId]);

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

  async function handleDelete() {
    if (!confirm("Soft-delete this organization? This cannot be easily undone.")) return;
    setActionBusy("Delete");
    setError(null);
    try {
      await authedFetch(`/admin/organizations/${organizationId}`, { method: "DELETE" });
      router.push("/admin/organizations");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete organization.");
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

  if (!org) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <p className="mt-4 text-sm text-slate-500">Organization not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin/organizations" className="text-sm text-slate-500 underline">
        Back to Organizations
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{org.name}</h1>
        <Badge variant={adminOrganizationStatusVariant(org.status)}>{org.status}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-500">/{org.slug}</p>

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
          <CardTitle>Organization Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={actionBusy !== null}
            onClick={() =>
              runAction("Suspend", async () => {
                await authedFetch(`/admin/organizations/${organizationId}/suspend`, {
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
              runAction("Reactivate", async () => {
                await authedFetch(`/admin/organizations/${organizationId}/reactivate`, {
                  method: "POST",
                });
              })
            }
          >
            Reactivate
          </Button>
          <Button
            variant="outline"
            disabled={actionBusy !== null}
            onClick={() =>
              runAction("Archive", async () => {
                await authedFetch(`/admin/organizations/${organizationId}/archive`, {
                  method: "POST",
                });
              })
            }
          >
            Archive
          </Button>
          <Button
            variant="ghost"
            disabled={actionBusy !== null}
            onClick={() => void handleDelete()}
          >
            {actionBusy === "Delete" ? "Deleting..." : "Delete"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Transfer Ownership</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runAction("Transfer ownership", async () => {
                await authedFetch(`/admin/organizations/${organizationId}/transfer-ownership`, {
                  method: "POST",
                  body: JSON.stringify({ newOwnerUserId }),
                });
                setNewOwnerUserId("");
              });
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <div>
              <Label htmlFor="newOwnerUserId">New owner user ID</Label>
              <Input
                id="newOwnerUserId"
                value={newOwnerUserId}
                onChange={(e) => setNewOwnerUserId(e.target.value)}
                className="w-72"
              />
            </div>
            <Button type="submit" disabled={actionBusy !== null || !newOwnerUserId}>
              Transfer
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Financial / ERP</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Financial mode</p>
            <p>{org.financialMode ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">ERP status</p>
            <p>{org.erpStatus ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">API usage</p>
            <p>{org.apiUsageCount ?? "not tracked"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Storage usage</p>
            <p>{org.storageUsage ?? "not tracked"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Members ({org.members?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!org.members || org.members.length === 0 ? (
            <p className="text-sm text-slate-500">No members.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {org.members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.displayName ?? m.email ?? m.userId}</TableCell>
                    <TableCell>{m.role}</TableCell>
                    <TableCell>
                      {m.joinedAt ? new Date(m.joinedAt).toLocaleString() : "—"}
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
