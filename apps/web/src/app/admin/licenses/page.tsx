"use client";

import { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import { LICENSE_TYPES, licenseStatusVariant } from "../../../lib/licenses-types";
import type { AdminLicenseListItem } from "../../../lib/admin-licenses-types";
import type { GeneratedLicenseKey } from "../../../lib/licenses-types";

export default function AdminLicensesPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<AdminLicenseListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [genOrgId, setGenOrgId] = useState("");
  const [genAppId, setGenAppId] = useState("");
  const [genType, setGenType] = useState(LICENSE_TYPES[0]);
  const [generatedKey, setGeneratedKey] = useState<GeneratedLicenseKey | null>(null);

  const [transferTargetUserId, setTransferTargetUserId] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<AdminLicenseListItem>>(`/admin/licenses`);
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load licenses.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedFetch<CursorResult<AdminLicenseListItem>>(
        `/admin/licenses?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more licenses.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function runAction(action: string, path: string, body?: Record<string, unknown>) {
    setActionBusy(action);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      setMessage(`${action} succeeded.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${action.toLowerCase()}.`);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setActionBusy("Generate");
    setError(null);
    setMessage(null);
    try {
      const data = await authedFetch<GeneratedLicenseKey>(`/admin/licenses`, {
        method: "POST",
        body: JSON.stringify({
          organizationId: genOrgId,
          applicationId: genAppId,
          type: genType,
        }),
      });
      setGeneratedKey(data);
      setMessage("License generated.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate license.");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Licenses</h1>
      <p className="mt-1 text-sm text-slate-500">All licenses across every organization.</p>

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
          <CardTitle>Generate a license</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="genOrgId">Organization ID</Label>
              <Input
                id="genOrgId"
                value={genOrgId}
                onChange={(e) => setGenOrgId(e.target.value)}
                className="w-56"
              />
            </div>
            <div>
              <Label htmlFor="genAppId">Application ID</Label>
              <Input
                id="genAppId"
                value={genAppId}
                onChange={(e) => setGenAppId(e.target.value)}
                className="w-56"
              />
            </div>
            <div>
              <Label htmlFor="genType">Type</Label>
              <Select
                id="genType"
                value={genType}
                onChange={(e) => setGenType(e.target.value as (typeof LICENSE_TYPES)[number])}
                className="w-40"
              >
                {LICENSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={actionBusy !== null || !genOrgId || !genAppId}>
              {actionBusy === "Generate" ? "Generating..." : "Generate"}
            </Button>
          </form>
          {generatedKey ? (
            <p className="mt-3 break-all rounded bg-slate-50 p-2 text-xs">
              Generated key (shown once): <span className="font-mono">{generatedKey.key}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No licenses found.</p>
      ) : (
        <>
          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">{l.id}</TableCell>
                  <TableCell>{l.type}</TableCell>
                  <TableCell>
                    <Badge variant={licenseStatusVariant(l.status)}>{l.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.organizationName ?? l.organizationId}
                  </TableCell>
                  <TableCell className="text-xs">
                    {l.expiresAt ? new Date(l.expiresAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="new user ID"
                        className="h-8 w-32 text-xs"
                        value={transferTargetUserId[l.id] ?? ""}
                        onChange={(e) =>
                          setTransferTargetUserId((prev) => ({ ...prev, [l.id]: e.target.value }))
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionBusy !== null || !transferTargetUserId[l.id]}
                        onClick={() =>
                          void runAction("Transfer", `/admin/licenses/${l.id}/transfer`, {
                            newUserId: transferTargetUserId[l.id],
                          })
                        }
                      >
                        Transfer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionBusy !== null}
                        onClick={() =>
                          void runAction("Deactivate", `/admin/licenses/${l.id}/deactivate`)
                        }
                      >
                        Deactivate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionBusy !== null}
                        onClick={() =>
                          void runAction("Reactivate", `/admin/licenses/${l.id}/reactivate`)
                        }
                      >
                        Reactivate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionBusy !== null}
                        onClick={() => void runAction("Revoke", `/admin/licenses/${l.id}/revoke`)}
                      >
                        Revoke
                      </Button>
                    </div>
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
