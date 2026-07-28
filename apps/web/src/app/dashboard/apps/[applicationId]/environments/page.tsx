"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../../components/protected-route";
import { DashboardNav } from "../../../../../components/dashboard-nav";
import { AppNav } from "../../../../../components/app-nav";
import { useAuth } from "../../../../../lib/auth-context";
import { ApiError } from "../../../../../lib/api-client";
import {
  APPLICATION_ENVIRONMENT_TYPES,
  type ApplicationEnvironment,
  type ApplicationEnvironmentType,
} from "../../../../../lib/applications-types";
import type { EnvironmentVariable } from "../../../../../lib/environment-variables-types";
import type { AllowedOrigin } from "../../../../../lib/allowed-origins-types";

function ApplicationEnvironmentsContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();

  const [environments, setEnvironments] = useState<ApplicationEnvironment[]>([]);
  const [selectedType, setSelectedType] = useState<ApplicationEnvironmentType>("DEVELOPMENT");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [baseUrl, setBaseUrl] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [variablesText, setVariablesText] = useState("{}");
  const [featureFlagsText, setFeatureFlagsText] = useState("{}");

  const selectedEnvironment = environments.find((e) => e.type === selectedType) ?? null;
  const selectedEnvironmentId = selectedEnvironment?.id ?? null;

  // --- Environment Variables (per-key, distinct from the JSON `variables`
  // blob above) ---
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>([]);
  const [envVarsLoading, setEnvVarsLoading] = useState(false);
  const [envVarsError, setEnvVarsError] = useState<string | null>(null);
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [newVarIsSecret, setNewVarIsSecret] = useState(false);
  const [savingVar, setSavingVar] = useState(false);
  const [editingVarValues, setEditingVarValues] = useState<Record<string, string>>({});

  // --- Allowed Origins ---
  const [origins, setOrigins] = useState<AllowedOrigin[]>([]);
  const [originsLoading, setOriginsLoading] = useState(false);
  const [originsError, setOriginsError] = useState<string | null>(null);
  const [newOrigin, setNewOrigin] = useState("");
  const [savingOrigin, setSavingOrigin] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<ApplicationEnvironment[]>(
        `/applications/${applicationId}/environments`,
      );
      setEnvironments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load environments.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const current = environments.find((e) => e.type === selectedType);
    setBaseUrl(current?.baseUrl ?? "");
    setApiUrl(current?.apiUrl ?? "");
    setVariablesText(JSON.stringify(current?.variables ?? {}, null, 2));
    setFeatureFlagsText(JSON.stringify(current?.featureFlags ?? {}, null, 2));
  }, [environments, selectedType]);

  const loadEnvVars = useCallback(async () => {
    if (!selectedEnvironmentId) {
      setEnvVars([]);
      return;
    }
    setEnvVarsLoading(true);
    setEnvVarsError(null);
    try {
      const data = await authedFetch<EnvironmentVariable[]>(
        `/applications/${applicationId}/environments/${selectedEnvironmentId}/variables`,
      );
      setEnvVars(data);
      setEditingVarValues(Object.fromEntries(data.map((v) => [v.key, v.value])));
    } catch (err) {
      setEnvVarsError(err instanceof ApiError ? err.message : "Could not load variables.");
    } finally {
      setEnvVarsLoading(false);
    }
  }, [authedFetch, applicationId, selectedEnvironmentId]);

  useEffect(() => {
    void loadEnvVars();
  }, [loadEnvVars]);

  const loadOrigins = useCallback(async () => {
    setOriginsLoading(true);
    setOriginsError(null);
    try {
      const data = await authedFetch<AllowedOrigin[]>(
        `/applications/${applicationId}/allowed-origins`,
      );
      setOrigins(data);
    } catch (err) {
      setOriginsError(err instanceof ApiError ? err.message : "Could not load allowed origins.");
    } finally {
      setOriginsLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void loadOrigins();
  }, [loadOrigins]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    let variables: unknown;
    let featureFlags: unknown;
    try {
      variables = JSON.parse(variablesText);
      featureFlags = JSON.parse(featureFlagsText);
    } catch {
      setError("Variables and feature flags must be valid JSON objects.");
      return;
    }

    setSaving(true);
    try {
      await authedFetch(`/applications/${applicationId}/environments/${selectedType}`, {
        method: "PUT",
        body: JSON.stringify({
          baseUrl: baseUrl || undefined,
          apiUrl: apiUrl || undefined,
          variables,
          featureFlags,
        }),
      });
      setMessage(`${selectedType} environment saved.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save environment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateVar(event: FormEvent) {
    event.preventDefault();
    if (!selectedEnvironmentId || !newVarKey) return;
    setSavingVar(true);
    setEnvVarsError(null);
    try {
      await authedFetch(
        `/applications/${applicationId}/environments/${selectedEnvironmentId}/variables/${encodeURIComponent(newVarKey)}`,
        {
          method: "PUT",
          body: JSON.stringify({ value: newVarValue, isSecret: newVarIsSecret }),
        },
      );
      setNewVarKey("");
      setNewVarValue("");
      setNewVarIsSecret(false);
      await loadEnvVars();
    } catch (err) {
      setEnvVarsError(err instanceof ApiError ? err.message : "Could not save variable.");
    } finally {
      setSavingVar(false);
    }
  }

  async function handleUpdateVar(key: string, isSecret: boolean) {
    if (!selectedEnvironmentId) return;
    const value = editingVarValues[key];
    if (value === undefined) return;
    setEnvVarsError(null);
    try {
      await authedFetch(
        `/applications/${applicationId}/environments/${selectedEnvironmentId}/variables/${encodeURIComponent(key)}`,
        { method: "PUT", body: JSON.stringify({ value, isSecret }) },
      );
      await loadEnvVars();
    } catch (err) {
      setEnvVarsError(err instanceof ApiError ? err.message : "Could not update variable.");
    }
  }

  async function handleDeleteVar(key: string) {
    if (!selectedEnvironmentId) return;
    setEnvVarsError(null);
    try {
      await authedFetch(
        `/applications/${applicationId}/environments/${selectedEnvironmentId}/variables/${encodeURIComponent(key)}`,
        { method: "DELETE" },
      );
      await loadEnvVars();
    } catch (err) {
      setEnvVarsError(err instanceof ApiError ? err.message : "Could not delete variable.");
    }
  }

  async function handleCreateOrigin(event: FormEvent) {
    event.preventDefault();
    if (!newOrigin) return;
    setSavingOrigin(true);
    setOriginsError(null);
    try {
      await authedFetch(`/applications/${applicationId}/allowed-origins`, {
        method: "POST",
        body: JSON.stringify({
          origin: newOrigin,
          environmentId: selectedEnvironmentId ?? undefined,
        }),
      });
      setNewOrigin("");
      await loadOrigins();
    } catch (err) {
      setOriginsError(err instanceof ApiError ? err.message : "Could not add allowed origin.");
    } finally {
      setSavingOrigin(false);
    }
  }

  async function handleDeleteOrigin(originId: string) {
    setOriginsError(null);
    try {
      await authedFetch(`/applications/${applicationId}/allowed-origins/${originId}`, {
        method: "DELETE",
      });
      await loadOrigins();
    } catch (err) {
      setOriginsError(err instanceof ApiError ? err.message : "Could not remove allowed origin.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <AppNav applicationId={applicationId} />
        <h1 className="text-2xl font-semibold text-slate-900">Environments</h1>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="mb-4">
              <Label htmlFor="environmentType">Environment</Label>
              <Select
                id="environmentType"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as ApplicationEnvironmentType)}
                className="w-56"
              >
                {APPLICATION_ENVIRONMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
                {error ? <Alert variant="destructive">{error}</Alert> : null}
                {message ? <Alert variant="success">{message}</Alert> : null}

                <div>
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://staging.getledgix.com"
                  />
                </div>
                <div>
                  <Label htmlFor="apiUrl">API URL</Label>
                  <Input
                    id="apiUrl"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api-staging.getledgix.com"
                  />
                </div>
                <div>
                  <Label htmlFor="variables">Environment variables (JSON)</Label>
                  <Textarea
                    id="variables"
                    value={variablesText}
                    onChange={(e) => setVariablesText(e.target.value)}
                    className="font-mono text-xs"
                    rows={6}
                  />
                </div>
                <div>
                  <Label htmlFor="featureFlags">Feature flags (JSON)</Label>
                  <Textarea
                    id="featureFlags"
                    value={featureFlagsText}
                    onChange={(e) => setFeatureFlagsText(e.target.value)}
                    className="font-mono text-xs"
                    rows={6}
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : `Save ${selectedType.toLowerCase()} environment`}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Environment Variables ({selectedType.toLowerCase()})</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedEnvironmentId ? (
              <p className="text-sm text-slate-500">
                Save this environment above before adding variables.
              </p>
            ) : (
              <>
                {envVarsError ? (
                  <Alert variant="destructive" className="mb-4">
                    {envVarsError}
                  </Alert>
                ) : null}

                {envVarsLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : envVars.length === 0 ? (
                  <p className="text-sm text-slate-500">No variables configured yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Secret</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {envVars.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono text-xs">{v.key}</TableCell>
                          <TableCell>
                            <Input
                              className="h-8 w-48 font-mono text-xs"
                              type={v.isSecret ? "password" : "text"}
                              value={editingVarValues[v.key] ?? ""}
                              onChange={(e) =>
                                setEditingVarValues((prev) => ({
                                  ...prev,
                                  [v.key]: e.target.value,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant={v.isSecret ? "outline" : "default"}>
                              {v.isSecret ? "secret" : "plain"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleUpdateVar(v.key, v.isSecret)}
                              >
                                Save
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleDeleteVar(v.key)}
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
                  onSubmit={handleCreateVar}
                  className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
                  noValidate
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="newVarKey">Key</Label>
                      <Input
                        id="newVarKey"
                        value={newVarKey}
                        onChange={(e) => setNewVarKey(e.target.value)}
                        placeholder="FEATURE_FLAG_X"
                      />
                    </div>
                    <div>
                      <Label htmlFor="newVarValue">Value</Label>
                      <Input
                        id="newVarValue"
                        value={newVarValue}
                        onChange={(e) => setNewVarValue(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={newVarIsSecret}
                          onChange={(e) => setNewVarIsSecret(e.target.checked)}
                        />
                        Secret (mask in UI)
                      </label>
                    </div>
                  </div>
                  <Button type="submit" disabled={savingVar || !newVarKey} className="w-fit">
                    {savingVar ? "Saving..." : "Add variable"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Allowed Origins</CardTitle>
          </CardHeader>
          <CardContent>
            {originsError ? (
              <Alert variant="destructive" className="mb-4">
                {originsError}
              </Alert>
            ) : null}

            {originsLoading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : origins.length === 0 ? (
              <p className="text-sm text-slate-500">No allowed origins configured yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origin</TableHead>
                    <TableHead>Environment</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {origins.map((origin) => (
                    <TableRow key={origin.id}>
                      <TableCell className="font-mono text-xs">{origin.origin}</TableCell>
                      <TableCell>
                        {origin.environmentId
                          ? (environments.find((e) => e.id === origin.environmentId)?.type ??
                            origin.environmentId)
                          : "All environments"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleDeleteOrigin(origin.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <form
              onSubmit={handleCreateOrigin}
              className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
              noValidate
            >
              <div className="flex-1">
                <Label htmlFor="newOrigin">Origin</Label>
                <Input
                  id="newOrigin"
                  value={newOrigin}
                  onChange={(e) => setNewOrigin(e.target.value)}
                  placeholder="https://app.example.com"
                />
              </div>
              <p className="text-xs text-slate-400 sm:max-w-xs">
                Scoped to the {selectedType.toLowerCase()} environment selected above.
              </p>
              <Button type="submit" disabled={savingOrigin || !newOrigin}>
                {savingOrigin ? "Adding..." : "Add origin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function ApplicationEnvironmentsPage() {
  return (
    <ProtectedRoute>
      <ApplicationEnvironmentsContent />
    </ProtectedRoute>
  );
}
