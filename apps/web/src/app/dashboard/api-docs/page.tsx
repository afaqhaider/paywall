"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type {
  ApplicationEnvironment,
  ApplicationListResult,
} from "../../../lib/applications-types";
import {
  SDK_PLATFORMS,
  SDK_PLATFORM_LABELS,
  type SdkConfig,
  type SdkPlatform,
} from "../../../lib/sdk-config-types";
import { env } from "../../../lib/env";

const API_URL = env.apiUrl;

function ApiDocsContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [environments, setEnvironments] = useState<ApplicationEnvironment[]>([]);
  const [environmentId, setEnvironmentId] = useState("");
  const [platform, setPlatform] = useState<SdkPlatform>("web");

  const [config, setConfig] = useState<SdkConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

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
      setEnvironmentId("");
      return;
    }
    try {
      const data = await authedFetch<ApplicationEnvironment[]>(
        `/applications/${applicationId}/environments`,
      );
      setEnvironments(data);
      setEnvironmentId((current) =>
        current && data.some((e) => e.id === current) ? current : (data[0]?.id ?? ""),
      );
    } catch {
      setEnvironments([]);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void loadEnvironments();
  }, [loadEnvironments]);

  const loadConfig = useCallback(async () => {
    if (!applicationId || !environmentId) {
      setConfig(null);
      return;
    }
    setLoadingConfig(true);
    setError(null);
    try {
      const data = await authedFetch<SdkConfig>(
        `/applications/${applicationId}/sdk-config/${platform}?environmentId=${environmentId}`,
      );
      setConfig(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load SDK configuration.");
    } finally {
      setLoadingConfig(false);
    }
  }, [authedFetch, applicationId, environmentId, platform]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

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
        <h1 className="text-2xl font-semibold text-slate-900">API Docs</h1>
        <p className="mt-1 text-sm text-slate-500">
          API reference and SDK setup for{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>API reference</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              The full OpenAPI reference is served by the API itself (auto-generated from its
              routes). It runs on a different origin than this dashboard, so it is opened in a new
              tab rather than embedded - an iframe would not carry this dashboard&apos;s auth
              cookies across origins anyway, and the Swagger UI has its own independent
              &quot;Authorize&quot; flow.
            </p>
            <a
              href={`${API_URL}/api-docs`}
              target="_blank"
              rel="noreferrer"
              className={`${buttonVariants()} mt-4 inline-flex`}
            >
              Open Swagger UI →
            </a>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-700">
            <p>
              Dashboard/user-authenticated requests use a bearer JWT:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                Authorization: Bearer &lt;access_token&gt;
              </code>
            </p>
            <p>
              Server-to-server / SDK requests authenticate with an API key instead, in the{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">X-API-Key</code> header.
              Generate one from{" "}
              <Link href="/dashboard/api-keys" className="underline">
                API Keys
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Code samples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="max-w-xs">
                <Label htmlFor="docsApplication">Application</Label>
                {applications && applications.items.length > 0 ? (
                  <Select
                    id="docsApplication"
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
              <div className="max-w-xs">
                <Label htmlFor="docsEnvironment">Environment</Label>
                <Select
                  id="docsEnvironment"
                  value={environmentId}
                  onChange={(e) => setEnvironmentId(e.target.value)}
                >
                  {environments.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.type}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="max-w-xs">
                <Label htmlFor="docsPlatform">Platform</Label>
                <Select
                  id="docsPlatform"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as SdkPlatform)}
                >
                  {SDK_PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {SDK_PLATFORM_LABELS[p]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {loadingConfig ? (
              <p className="mt-4 text-sm text-slate-500">Loading…</p>
            ) : config ? (
              <div className="mt-4">
                <pre className="max-h-80 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50">
                  {config.snippet}
                </pre>
                <p className="mt-3 text-sm text-slate-600">{config.instructions}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Select an application and environment to see a setup snippet.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function ApiDocsPage() {
  return (
    <ProtectedRoute>
      <ApiDocsContent />
    </ProtectedRoute>
  );
}
