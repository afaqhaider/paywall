"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
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
import { ProtectedRoute } from "../../../../../components/protected-route";
import { DashboardNav } from "../../../../../components/dashboard-nav";
import { AppNav } from "../../../../../components/app-nav";
import { useAuth } from "../../../../../lib/auth-context";
import { ApiError } from "../../../../../lib/api-client";
import {
  APPLICATION_SECRET_TYPES,
  type ApplicationSecretMetadata,
  type ApplicationSecretType,
} from "../../../../../lib/applications-types";

function ApplicationSecretsContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();

  const [secrets, setSecrets] = useState<ApplicationSecretMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<ApplicationSecretType>("API_KEY");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [creating, setCreating] = useState(false);

  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const [rotateValue, setRotateValue] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<ApplicationSecretMetadata[]>(
        `/applications/${applicationId}/secrets`,
      );
      setSecrets(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load secrets.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await authedFetch(`/applications/${applicationId}/secrets`, {
        method: "POST",
        body: JSON.stringify({ type, key, value }),
      });
      setKey("");
      setValue("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create secret.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRotate(secretId: string) {
    if (!rotateValue) return;
    try {
      await authedFetch(`/applications/${applicationId}/secrets/${secretId}`, {
        method: "PATCH",
        body: JSON.stringify({ value: rotateValue }),
      });
      setRotatingId(null);
      setRotateValue("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rotate secret.");
    }
  }

  async function handleRemove(secretId: string) {
    try {
      await authedFetch(`/applications/${applicationId}/secrets/${secretId}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove secret.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <AppNav applicationId={applicationId} />
        <h1 className="text-2xl font-semibold text-slate-900">Secrets</h1>
        <p className="mt-1 text-sm text-slate-500">
          Values are encrypted at rest and never shown again after creation - only a masked hint is
          displayed.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <Card className="mt-6">
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : secrets.length === 0 ? (
              <p className="text-sm text-slate-500">No secrets stored yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secrets.map((secret) => (
                    <TableRow key={secret.id}>
                      <TableCell className="font-medium text-slate-900">{secret.key}</TableCell>
                      <TableCell>{secret.type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        •••• {secret.lastFour ?? "----"}
                      </TableCell>
                      <TableCell className="space-x-2">
                        {rotatingId === secret.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={rotateValue}
                              onChange={(e) => setRotateValue(e.target.value)}
                              placeholder="New value"
                              className="h-8 w-40"
                            />
                            <Button size="sm" onClick={() => void handleRotate(secret.id)}>
                              Save
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRotatingId(null);
                                setRotateValue("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRotatingId(secret.id)}
                            >
                              Rotate
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleRemove(secret.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="secretType">Type</Label>
                  <Select
                    id="secretType"
                    value={type}
                    onChange={(e) => setType(e.target.value as ApplicationSecretType)}
                  >
                    {APPLICATION_SECRET_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="secretKey">Key</Label>
                  <Input
                    id="secretKey"
                    required
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="STRIPE_WEBHOOK_SECRET"
                  />
                </div>
                <div>
                  <Label htmlFor="secretValue">Value</Label>
                  <Input
                    id="secretValue"
                    required
                    type="password"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Saving..." : "Save secret"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function ApplicationSecretsPage() {
  return (
    <ProtectedRoute>
      <ApplicationSecretsContent />
    </ProtectedRoute>
  );
}
