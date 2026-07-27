"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { Alert, Button, Card, CardContent, Input, Label, Select, Textarea } from "@paywall/ui";
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
