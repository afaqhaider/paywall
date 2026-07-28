"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { CopyableSecret } from "../../../../components/copyable-secret";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import type { APIClient, APIKey, GeneratedAPIKey } from "../../../../lib/api-keys-types";

function ApiClientDetailContent() {
  const { apiClientId } = useParams<{ apiClientId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [client, setClient] = useState<APIClient | null>(null);
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [keyName, setKeyName] = useState("");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [rateLimitPerMin, setRateLimitPerMin] = useState("");
  const [scopesInput, setScopesInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<GeneratedAPIKey | null>(null);
  const [newScope, setNewScope] = useState<Record<string, string>>({});

  const loadClient = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<APIClient>(
        `/organizations/${selectedOrgId}/api-clients/${apiClientId}`,
      );
      setClient(data);
      setName(data.name);
      setDescription(data.description ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load API client.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, apiClientId]);

  const loadKeys = useCallback(async () => {
    try {
      const data = await authedFetch<APIKey[]>(`/api-clients/${apiClientId}/keys`);
      setKeys(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load API keys.");
    }
  }, [authedFetch, apiClientId]);

  useEffect(() => {
    void loadClient();
  }, [loadClient]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setSaving(true);
    setActionMessage(null);
    try {
      const updated = await authedFetch<APIClient>(
        `/organizations/${selectedOrgId}/api-clients/${apiClientId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name, description: description || undefined }),
        },
      );
      setClient(updated);
      setActionMessage("Client updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update client.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateKey(event: FormEvent) {
    event.preventDefault();
    setGenerating(true);
    setError(null);
    setGeneratedKey(null);
    try {
      const scopes = scopesInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const key = await authedFetch<GeneratedAPIKey>(`/api-clients/${apiClientId}/keys`, {
        method: "POST",
        body: JSON.stringify({
          name: keyName,
          environment,
          rateLimitPerMin: rateLimitPerMin ? Number(rateLimitPerMin) : undefined,
          scopes: scopes.length ? scopes : undefined,
        }),
      });
      setGeneratedKey(key);
      setKeyName("");
      setScopesInput("");
      await loadKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate API key.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(apiKeyId: string) {
    setActionMessage(null);
    try {
      await authedFetch(`/api-clients/${apiClientId}/keys/${apiKeyId}/revoke`, { method: "POST" });
      setActionMessage("API key revoked.");
      await loadKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke API key.");
    }
  }

  async function handleRotate(apiKeyId: string) {
    setActionMessage(null);
    setGeneratedKey(null);
    try {
      const key = await authedFetch<GeneratedAPIKey>(
        `/api-clients/${apiClientId}/keys/${apiKeyId}/rotate`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setGeneratedKey(key);
      await loadKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rotate API key.");
    }
  }

  async function handleAddScope(apiKeyId: string) {
    const scope = newScope[apiKeyId];
    if (!scope) return;
    setActionMessage(null);
    try {
      await authedFetch(`/api-clients/${apiClientId}/keys/${apiKeyId}/scopes`, {
        method: "POST",
        body: JSON.stringify({ scope }),
      });
      setNewScope((prev) => ({ ...prev, [apiKeyId]: "" }));
      await loadKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add scope.");
    }
  }

  async function handleRemoveScope(apiKeyId: string, scope: string) {
    setActionMessage(null);
    try {
      await authedFetch(
        `/api-clients/${apiClientId}/keys/${apiKeyId}/scopes/${encodeURIComponent(scope)}`,
        { method: "DELETE" },
      );
      await loadKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove scope.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/dashboard/api-keys" className="text-sm text-slate-500 hover:text-slate-900">
          ← API Keys
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        {loading || !client ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">{client.name}</h1>
            <p className="mt-1 font-mono text-xs text-slate-500">{client.id}</p>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
                  <div>
                    <Label htmlFor="clientName">Name</Label>
                    <Input
                      id="clientName"
                      required
                      maxLength={200}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientDescription">Description</Label>
                    <Input
                      id="clientDescription"
                      maxLength={2000}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Keys</CardTitle>
              </CardHeader>
              <CardContent>
                {generatedKey ? (
                  <Alert className="mb-4">
                    <p className="font-medium">
                      Key generated - copy it now, it will not be shown again.
                    </p>
                    <div className="mt-2">
                      <CopyableSecret value={generatedKey.plainText} />
                    </div>
                  </Alert>
                ) : null}

                {keys.length === 0 ? (
                  <p className="text-sm text-slate-500">No API keys generated yet.</p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {keys.map((key) => (
                      <div key={key.id} className="rounded-md border border-slate-100 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-900">{key.name}</p>
                            <p className="font-mono text-xs text-slate-500">
                              {key.keyPrefix}…{key.lastFour}
                            </p>
                          </div>
                          <Badge variant={key.revokedAt ? "destructive" : "success"}>
                            {key.revokedAt ? "REVOKED" : "ACTIVE"}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {key.scopes.map((scope) => (
                            <Badge
                              key={scope.id}
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              {scope.scope}
                              <button
                                type="button"
                                className="text-slate-400 hover:text-slate-900"
                                onClick={() => void handleRemoveScope(key.id, scope.scope)}
                                aria-label={`Remove scope ${scope.scope}`}
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Input
                            className="h-8 w-40"
                            placeholder="Add scope"
                            value={newScope[key.id] ?? ""}
                            onChange={(e) =>
                              setNewScope((prev) => ({ ...prev, [key.id]: e.target.value }))
                            }
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!newScope[key.id]}
                            onClick={() => void handleAddScope(key.id)}
                          >
                            Add scope
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={Boolean(key.revokedAt)}
                            onClick={() => void handleRevoke(key.id)}
                          >
                            Revoke
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRotate(key.id)}
                          >
                            Rotate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  onSubmit={handleGenerateKey}
                  className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
                  noValidate
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <Label htmlFor="keyName">Name</Label>
                      <Input
                        id="keyName"
                        required
                        maxLength={200}
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        placeholder="Production key"
                      />
                    </div>
                    <div>
                      <Label htmlFor="environment">Environment</Label>
                      <Select
                        id="environment"
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value as "live" | "test")}
                      >
                        <option value="live">live</option>
                        <option value="test">test</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="rateLimitPerMin">Rate limit / min</Label>
                      <Input
                        id="rateLimitPerMin"
                        type="number"
                        min={1}
                        value={rateLimitPerMin}
                        onChange={(e) => setRateLimitPerMin(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label htmlFor="scopesInput">Scopes</Label>
                      <Input
                        id="scopesInput"
                        value={scopesInput}
                        onChange={(e) => setScopesInput(e.target.value)}
                        placeholder="comma,separated"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={generating || !keyName}>
                    {generating ? "Generating..." : "Generate key"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function ApiClientDetailPage() {
  return (
    <ProtectedRoute>
      <ApiClientDetailContent />
    </ProtectedRoute>
  );
}
