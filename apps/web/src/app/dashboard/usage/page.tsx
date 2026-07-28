"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { ApplicationListResult } from "../../../lib/applications-types";
import type { EntitlementDefinition } from "../../../lib/features-types";
import {
  USAGE_RESET_POLICIES,
  type UsageLimit,
  type UsageResetPolicy,
} from "../../../lib/usage-limits-types";

interface EditState {
  limitValue: string;
  isUnlimited: boolean;
  resetPolicy: UsageResetPolicy;
}

function UsageDashboardContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");

  const [limits, setLimits] = useState<UsageLimit[]>([]);
  const [definitions, setDefinitions] = useState<EntitlementDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [edits, setEdits] = useState<Record<string, EditState>>({});

  // New limit form
  const [newKey, setNewKey] = useState("");
  const [newLimitValue, setNewLimitValue] = useState("");
  const [newIsUnlimited, setNewIsUnlimited] = useState(false);
  const [newResetPolicy, setNewResetPolicy] = useState<UsageResetPolicy>("NEVER");
  const [saving, setSaving] = useState(false);

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

  const loadDefinitions = useCallback(async () => {
    if (!applicationId) {
      setDefinitions([]);
      return;
    }
    try {
      const data = await authedFetch<EntitlementDefinition[]>(
        `/applications/${applicationId}/entitlement-definitions`,
      );
      setDefinitions(data);
      setNewKey((current) => current || (data[0]?.key ?? ""));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load entitlement definitions.");
    }
  }, [authedFetch, applicationId]);

  const loadLimits = useCallback(async () => {
    if (!selectedOrgId || !applicationId) {
      setLimits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<UsageLimit[]>(
        `/organizations/${selectedOrgId}/applications/${applicationId}/usage-limits`,
      );
      setLimits(data);
      setEdits(
        Object.fromEntries(
          data.map((limit) => [
            limit.entitlementDefinitionId,
            {
              limitValue: limit.limitValue != null ? String(limit.limitValue) : "",
              isUnlimited: limit.isUnlimited,
              resetPolicy: limit.resetPolicy,
            },
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load usage limits.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, applicationId]);

  useEffect(() => {
    void loadDefinitions();
  }, [loadDefinitions]);

  useEffect(() => {
    void loadLimits();
  }, [loadLimits]);

  async function handleSaveLimit(key: string, entitlementDefinitionId: string) {
    if (!selectedOrgId || !applicationId) return;
    const edit = edits[entitlementDefinitionId];
    if (!edit) return;
    setActionMessage(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/applications/${applicationId}/usage-limits/${encodeURIComponent(key)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            limitValue: edit.limitValue !== "" ? Number(edit.limitValue) : undefined,
            isUnlimited: edit.isUnlimited,
            resetPolicy: edit.resetPolicy,
          }),
        },
      );
      setActionMessage(`Limit for "${key}" saved.`);
      await loadLimits();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save usage limit.");
    }
  }

  async function handleReset(key: string) {
    if (!selectedOrgId || !applicationId) return;
    setActionMessage(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/applications/${applicationId}/usage-limits/${encodeURIComponent(key)}/reset`,
        { method: "POST" },
      );
      setActionMessage(`Counter for "${key}" reset.`);
      await loadLimits();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset counter.");
    }
  }

  async function handleCreateLimit(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId || !applicationId || !newKey) return;
    setSaving(true);
    setActionMessage(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/applications/${applicationId}/usage-limits/${encodeURIComponent(newKey)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            limitValue: newLimitValue !== "" ? Number(newLimitValue) : undefined,
            isUnlimited: newIsUnlimited,
            resetPolicy: newResetPolicy,
          }),
        },
      );
      setNewLimitValue("");
      setNewIsUnlimited(false);
      setNewResetPolicy("NEVER");
      setActionMessage(`Limit for "${newKey}" created.`);
      await loadLimits();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create usage limit.");
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-semibold text-slate-900">Usage Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Usage ceilings and running counters for{" "}
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
            <CardTitle>Limits</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : limits.length === 0 ? (
              <p className="text-sm text-slate-500">No usage limits configured yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Unlimited</TableHead>
                    <TableHead>Reset policy</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limits.map((limit) => {
                    const key = limit.entitlementDefinition?.key ?? limit.entitlementDefinitionId;
                    const edit = edits[limit.entitlementDefinitionId] ?? {
                      limitValue: "",
                      isUnlimited: false,
                      resetPolicy: "NEVER" as UsageResetPolicy,
                    };
                    return (
                      <TableRow key={limit.id}>
                        <TableCell className="font-mono text-xs">{key}</TableCell>
                        <TableCell>
                          {limit.counter?.value ?? 0}
                          <Badge variant="outline" className="ml-2">
                            {limit.counter ? "tracked" : "no activity yet"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8 w-24"
                            type="number"
                            value={edit.limitValue}
                            disabled={edit.isUnlimited}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [limit.entitlementDefinitionId]: {
                                  ...edit,
                                  limitValue: e.target.value,
                                },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={edit.isUnlimited}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [limit.entitlementDefinitionId]: {
                                  ...edit,
                                  isUnlimited: e.target.checked,
                                },
                              }))
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            className="h-8 w-32"
                            value={edit.resetPolicy}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [limit.entitlementDefinitionId]: {
                                  ...edit,
                                  resetPolicy: e.target.value as UsageResetPolicy,
                                },
                              }))
                            }
                          >
                            {USAGE_RESET_POLICIES.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                void handleSaveLimit(key, limit.entitlementDefinitionId)
                              }
                            >
                              Save
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void handleReset(key)}>
                              Reset
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            <form
              onSubmit={handleCreateLimit}
              className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
              noValidate
            >
              <h3 className="text-sm font-medium text-slate-700">Add / update a limit</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <Label htmlFor="newKey">Entitlement key</Label>
                  {definitions.length > 0 ? (
                    <Select id="newKey" value={newKey} onChange={(e) => setNewKey(e.target.value)}>
                      {definitions.map((def) => (
                        <option key={def.id} value={def.key}>
                          {def.key}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id="newKey"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="api_calls"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="newLimitValue">Limit value</Label>
                  <Input
                    id="newLimitValue"
                    type="number"
                    value={newLimitValue}
                    disabled={newIsUnlimited}
                    onChange={(e) => setNewLimitValue(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="newResetPolicy">Reset policy</Label>
                  <Select
                    id="newResetPolicy"
                    value={newResetPolicy}
                    onChange={(e) => setNewResetPolicy(e.target.value as UsageResetPolicy)}
                  >
                    {USAGE_RESET_POLICIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={newIsUnlimited}
                      onChange={(e) => setNewIsUnlimited(e.target.checked)}
                    />
                    Unlimited
                  </label>
                </div>
              </div>
              <Button type="submit" disabled={saving || !newKey}>
                {saving ? "Saving..." : "Save limit"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function UsageDashboardPage() {
  return (
    <ProtectedRoute>
      <UsageDashboardContent />
    </ProtectedRoute>
  );
}
