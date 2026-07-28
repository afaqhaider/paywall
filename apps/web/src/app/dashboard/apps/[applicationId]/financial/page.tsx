"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../../components/protected-route";
import { DashboardNav } from "../../../../../components/dashboard-nav";
import { AppNav } from "../../../../../components/app-nav";
import { useAuth } from "../../../../../lib/auth-context";
import { useOrg } from "../../../../../lib/org-context";
import { ApiError } from "../../../../../lib/api-client";
import {
  ERP_RESOURCE_TYPES,
  erpResourceLabel,
  erpStatusVariant,
  type ErpConnection,
  type ErpConnectionTestResult,
  type ErpPermission,
  type FinancialIntegration,
  type FinancialProvider,
} from "../../../../../lib/financial-integration-types";
import type { FinancialSyncStatusSummary } from "../../../../../lib/financial-sync-types";

function ApplicationFinancialContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [integration, setIntegration] = useState<FinancialIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [providerSaving, setProviderSaving] = useState(false);

  // ERP connection form
  const [baseUrl, setBaseUrl] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [connectionSaving, setConnectionSaving] = useState(false);
  const [testResult, setTestResult] = useState<ErpConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Rotate key
  const [rotateKey, setRotateKey] = useState("");
  const [rotating, setRotating] = useState(false);

  // Sync status
  const [syncStatus, setSyncStatus] = useState<FinancialSyncStatusSummary | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = useState(false);

  // Permissions
  const [permissions, setPermissions] = useState<ErpPermission[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [permissionsMessage, setPermissionsMessage] = useState<string | null>(null);

  const erpConnection = integration?.erpConnection ?? null;

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<FinancialIntegration>(
        `/organizations/${selectedOrgId}/financial-integration`,
      );
      setIntegration(data);
      setBaseUrl(data.erpConnection?.baseUrl ?? "");
      setCompanyId(data.erpConnection?.companyId ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load financial integration.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSyncStatus = useCallback(async () => {
    if (!selectedOrgId) return;
    setSyncStatusLoading(true);
    try {
      const data = await authedFetch<FinancialSyncStatusSummary>(
        `/organizations/${selectedOrgId}/financial-sync/status`,
      );
      setSyncStatus(data);
    } catch {
      // Non-fatal - the ERP sync agent's routes may not be reachable yet; the
      // panel just shows nothing rather than erroring the whole page.
      setSyncStatus(null);
    } finally {
      setSyncStatusLoading(false);
    }
  }, [authedFetch, selectedOrgId]);

  const loadPermissions = useCallback(async () => {
    if (!selectedOrgId || !erpConnection) {
      setPermissions([]);
      return;
    }
    setPermissionsLoading(true);
    setPermissionsError(null);
    try {
      const data = await authedFetch<ErpPermission[]>(
        `/organizations/${selectedOrgId}/financial-integration/erp-connection/permissions`,
      );
      setPermissions(data);
    } catch (err) {
      setPermissionsError(
        err instanceof ApiError ? err.message : "Could not load ERP permissions.",
      );
    } finally {
      setPermissionsLoading(false);
    }
  }, [authedFetch, selectedOrgId, erpConnection]);

  useEffect(() => {
    if (integration?.provider === "LEDGIX_ERP") {
      void loadSyncStatus();
      void loadPermissions();
    }
  }, [integration?.provider, loadSyncStatus, loadPermissions]);

  async function handleSelectProvider(provider: FinancialProvider) {
    if (!selectedOrgId || provider === integration?.provider) return;
    setProviderSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await authedFetch<FinancialIntegration>(
        `/organizations/${selectedOrgId}/financial-integration`,
        { method: "PUT", body: JSON.stringify({ provider }) },
      );
      setIntegration(data);
      setMessage(`Switched to ${provider === "LEDGIX_ERP" ? "LedGix ERP" : "internal finance"}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not switch provider.");
    } finally {
      setProviderSaving(false);
    }
  }

  async function handleSaveConnection(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setConnectionSaving(true);
    setError(null);
    setMessage(null);
    try {
      let data: ErpConnection;
      if (!erpConnection) {
        data = await authedFetch<ErpConnection>(
          `/organizations/${selectedOrgId}/financial-integration/erp-connection`,
          { method: "POST", body: JSON.stringify({ baseUrl, companyId, apiKey }) },
        );
      } else {
        data = await authedFetch<ErpConnection>(
          `/organizations/${selectedOrgId}/financial-integration/erp-connection`,
          { method: "PATCH", body: JSON.stringify({ baseUrl, companyId }) },
        );
      }
      setIntegration((prev) => (prev ? { ...prev, erpConnection: data } : prev));
      setApiKey("");
      setMessage("ERP connection configuration saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save ERP connection.");
    } finally {
      setConnectionSaving(false);
    }
  }

  async function handleTestConnection() {
    if (!selectedOrgId) return;
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const result = await authedFetch<ErpConnectionTestResult>(
        `/organizations/${selectedOrgId}/financial-integration/erp-connection/test`,
        { method: "POST" },
      );
      setTestResult(result);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not test the ERP connection.");
    } finally {
      setTesting(false);
    }
  }

  async function handleRotateKey(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId || !rotateKey) return;
    setRotating(true);
    setError(null);
    setMessage(null);
    try {
      const data = await authedFetch<ErpConnection>(
        `/organizations/${selectedOrgId}/financial-integration/erp-connection/rotate-key`,
        { method: "POST", body: JSON.stringify({ apiKey: rotateKey }) },
      );
      setIntegration((prev) => (prev ? { ...prev, erpConnection: data } : prev));
      setRotateKey("");
      setMessage("API key rotated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rotate the API key.");
    } finally {
      setRotating(false);
    }
  }

  async function handleDisconnect() {
    if (!selectedOrgId) return;
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`/organizations/${selectedOrgId}/financial-integration/erp-connection`, {
        method: "DELETE",
      });
      setMessage("ERP connection removed.");
      setBaseUrl("");
      setCompanyId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not disconnect the ERP connection.");
    }
  }

  function updatePermission(
    resource: ErpPermission["resource"],
    field: "canRead" | "canWrite",
    value: boolean,
  ) {
    setPermissions((prev) => {
      const existing = prev.find((p) => p.resource === resource);
      if (existing) {
        return prev.map((p) => (p.resource === resource ? { ...p, [field]: value } : p));
      }
      return [
        ...prev,
        {
          resource,
          canRead: field === "canRead" ? value : false,
          canWrite: field === "canWrite" ? value : false,
        },
      ];
    });
  }

  async function handleSavePermissions() {
    if (!selectedOrgId) return;
    setPermissionsSaving(true);
    setPermissionsError(null);
    setPermissionsMessage(null);
    try {
      const data = await authedFetch<ErpPermission[]>(
        `/organizations/${selectedOrgId}/financial-integration/erp-connection/permissions`,
        {
          method: "PUT",
          body: JSON.stringify({
            permissions: permissions.map((p) => ({
              resource: p.resource,
              canRead: p.canRead,
              canWrite: p.canWrite,
            })),
          }),
        },
      );
      setPermissions(data);
      setPermissionsMessage("Permissions saved.");
    } catch (err) {
      setPermissionsError(err instanceof ApiError ? err.message : "Could not save permissions.");
    } finally {
      setPermissionsSaving(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <AppNav applicationId={applicationId} />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Financial System</h1>
          <Link
            href={`/dashboard/apps/${applicationId}/financial/docs`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            LedGix ERP documentation
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Choose how this organization&apos;s billing events flow into your accounting system.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {message ? <Alert className="mt-4">{message}</Alert> : null}

        {loading || !integration ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={providerSaving}
                    onClick={() => void handleSelectProvider("INTERNAL")}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      integration.provider === "INTERNAL"
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <p className="font-medium text-slate-900">Use Internal Finance</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Keep invoices, receipts and transactions in this platform only.
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={providerSaving}
                    onClick={() => void handleSelectProvider("LEDGIX_ERP")}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      integration.provider === "LEDGIX_ERP"
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <p className="font-medium text-slate-900">
                      Connect LedGix ERP{" "}
                      <Badge variant="success" className="ml-1">
                        Recommended
                      </Badge>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Sync financial events to your LedGix ERP company automatically.
                    </p>
                  </button>
                </div>
              </CardContent>
            </Card>

            {integration.provider === "LEDGIX_ERP" ? (
              <>
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>ERP connection</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      onSubmit={handleSaveConnection}
                      className="flex flex-col gap-4"
                      noValidate
                    >
                      <div>
                        <Label htmlFor="baseUrl">ERP Base URL</Label>
                        <Input
                          id="baseUrl"
                          required
                          value={baseUrl}
                          onChange={(e) => setBaseUrl(e.target.value)}
                          placeholder="https://erp.example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="companyId">Company ID</Label>
                        <Input
                          id="companyId"
                          required
                          value={companyId}
                          onChange={(e) => setCompanyId(e.target.value)}
                          placeholder="COMP-0001"
                        />
                      </div>
                      {!erpConnection ? (
                        <div>
                          <Label htmlFor="apiKey">API Key</Label>
                          <Input
                            id="apiKey"
                            type="password"
                            required
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="LedGix API key"
                          />
                        </div>
                      ) : null}
                      <div className="flex gap-2">
                        <Button type="submit" disabled={connectionSaving}>
                          {connectionSaving
                            ? "Saving..."
                            : erpConnection
                              ? "Save configuration"
                              : "Connect LedGix ERP"}
                        </Button>
                        {erpConnection ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={testing}
                            onClick={() => void handleTestConnection()}
                          >
                            {testing ? "Testing..." : "Test connection"}
                          </Button>
                        ) : null}
                      </div>
                    </form>

                    {testResult ? (
                      <Alert
                        variant={testResult.status === "CONNECTED" ? "success" : "destructive"}
                        className="mt-4"
                      >
                        {testResult.status === "CONNECTED"
                          ? `Connected to ${testResult.company?.name ?? "company"} (${testResult.company?.baseCurrency ?? "?"}) at ${new Date(testResult.testedAt).toLocaleString()}.`
                          : (testResult.error ?? "Connection test failed.")}
                      </Alert>
                    ) : null}

                    {erpConnection ? (
                      <form
                        onSubmit={handleRotateKey}
                        className="mt-6 flex items-end gap-3 border-t border-slate-100 pt-4"
                      >
                        <div className="flex-1">
                          <Label htmlFor="rotateKey">Rotate API key</Label>
                          <Input
                            id="rotateKey"
                            type="password"
                            value={rotateKey}
                            onChange={(e) => setRotateKey(e.target.value)}
                            placeholder="New LedGix API key"
                          />
                        </div>
                        <Button type="submit" variant="outline" disabled={rotating || !rotateKey}>
                          {rotating ? "Rotating..." : "Rotate key"}
                        </Button>
                      </form>
                    ) : null}

                    {erpConnection ? (
                      <div className="mt-6 border-t border-slate-100 pt-4">
                        <Button variant="ghost" size="sm" onClick={() => void handleDisconnect()}>
                          Disconnect ERP
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {erpConnection ? (
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Connection status</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-700">
                        <p>
                          Status:{" "}
                          <Badge variant={erpStatusVariant(erpConnection.status)}>
                            {erpConnection.status}
                          </Badge>
                        </p>
                        <p className="text-xs text-slate-500">
                          Key ending in {erpConnection.lastFour ?? "????"}
                        </p>
                        {erpConnection.company ? (
                          <p className="text-xs text-slate-500">
                            Company: {erpConnection.company.name} (
                            {erpConnection.company.baseCurrency})
                          </p>
                        ) : null}
                        <p className="text-xs text-slate-500">
                          Last tested:{" "}
                          {erpConnection.lastTestedAt
                            ? new Date(erpConnection.lastTestedAt).toLocaleString()
                            : "Never"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Last synced:{" "}
                          {erpConnection.lastSyncedAt
                            ? new Date(erpConnection.lastSyncedAt).toLocaleString()
                            : "Never"}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Sync status</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-700">
                        {syncStatusLoading ? (
                          <p className="text-slate-500">Loading…</p>
                        ) : !syncStatus ? (
                          <p className="text-slate-500">Sync status unavailable.</p>
                        ) : (
                          <>
                            <p>Pending: {syncStatus.pendingCount}</p>
                            <p>Retrying: {syncStatus.retryingCount}</p>
                            <p>Dead-lettered: {syncStatus.deadLetterCount}</p>
                            <p className="text-xs text-slate-500">
                              Last synced:{" "}
                              {syncStatus.lastSyncedAt
                                ? new Date(syncStatus.lastSyncedAt).toLocaleString()
                                : "Never"}
                            </p>
                          </>
                        )}
                        <Link
                          href={`/dashboard/apps/${applicationId}/financial/sync-history`}
                          className="mt-2 inline-block text-xs font-medium text-slate-900 underline"
                        >
                          View sync history
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                {erpConnection ? (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Permissions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-4 text-xs text-slate-500">
                        Control which LedGix ERP resources this platform may read from and write to.
                        There is no delete capability - LedGix never allows this integration to
                        delete records.
                      </p>
                      {permissionsError ? (
                        <Alert variant="destructive" className="mb-4">
                          {permissionsError}
                        </Alert>
                      ) : null}
                      {permissionsMessage ? (
                        <Alert variant="success" className="mb-4">
                          {permissionsMessage}
                        </Alert>
                      ) : null}
                      {permissionsLoading ? (
                        <p className="text-sm text-slate-500">Loading…</p>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                                  <th className="py-2">Resource</th>
                                  <th className="py-2">Read</th>
                                  <th className="py-2">Write</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {ERP_RESOURCE_TYPES.map((resource) => {
                                  const perm = permissions.find((p) => p.resource === resource);
                                  return (
                                    <tr key={resource}>
                                      <td className="py-2">{erpResourceLabel(resource)}</td>
                                      <td className="py-2">
                                        <input
                                          type="checkbox"
                                          checked={perm?.canRead ?? false}
                                          onChange={(e) =>
                                            updatePermission(resource, "canRead", e.target.checked)
                                          }
                                        />
                                      </td>
                                      <td className="py-2">
                                        <input
                                          type="checkbox"
                                          checked={perm?.canWrite ?? false}
                                          onChange={(e) =>
                                            updatePermission(resource, "canWrite", e.target.checked)
                                          }
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <Button
                            className="mt-4"
                            disabled={permissionsSaving}
                            onClick={() => void handleSavePermissions()}
                          >
                            {permissionsSaving ? "Saving..." : "Save permissions"}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}

export default function ApplicationFinancialPage() {
  return (
    <ProtectedRoute>
      <ApplicationFinancialContent />
    </ProtectedRoute>
  );
}
