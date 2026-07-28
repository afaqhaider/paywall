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
  ENTITLEMENT_GRANT_SOURCES,
  type EntitlementCheckResult,
  type EntitlementGrant,
  type EntitlementGrantSource,
  type UsageSnapshot,
} from "../../../lib/entitlements-types";

function EntitlementsContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");

  const [definitions, setDefinitions] = useState<EntitlementDefinition[]>([]);
  const [grants, setGrants] = useState<EntitlementGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Manual grant form
  const [entitlementDefinitionId, setEntitlementDefinitionId] = useState("");
  const [source, setSource] = useState<EntitlementGrantSource>("MANUAL");
  const [numberValue, setNumberValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [boolValue, setBoolValue] = useState(false);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [creatingGrant, setCreatingGrant] = useState(false);

  // Entitlement definition quick-create (needed to have something to grant against)
  const [defKey, setDefKey] = useState("");
  const [defName, setDefName] = useState("");
  const [creatingDefinition, setCreatingDefinition] = useState(false);

  // Runtime check tester
  const [testerKey, setTesterKey] = useState("");
  const [testerIncrementAmount, setTesterIncrementAmount] = useState("1");
  const [checkResult, setCheckResult] = useState<EntitlementCheckResult | null>(null);
  const [usageResult, setUsageResult] = useState<UsageSnapshot | null>(null);
  const [testerBusy, setTesterBusy] = useState(false);
  const [testerError, setTesterError] = useState<string | null>(null);

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
      setEntitlementDefinitionId((current) =>
        current && data.some((d) => d.id === current) ? current : (data[0]?.id ?? ""),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load entitlement definitions.");
    }
  }, [authedFetch, applicationId]);

  const loadGrants = useCallback(async () => {
    if (!selectedOrgId || !applicationId) {
      setGrants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<EntitlementGrant[]>(
        `/organizations/${selectedOrgId}/entitlement-grants?applicationId=${applicationId}`,
      );
      setGrants(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load entitlement grants.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, applicationId]);

  useEffect(() => {
    void loadDefinitions();
  }, [loadDefinitions]);

  useEffect(() => {
    void loadGrants();
  }, [loadGrants]);

  async function handleCreateDefinition(event: FormEvent) {
    event.preventDefault();
    if (!applicationId) return;
    setCreatingDefinition(true);
    setError(null);
    try {
      await authedFetch(`/applications/${applicationId}/entitlement-definitions`, {
        method: "POST",
        body: JSON.stringify({ key: defKey, name: defName }),
      });
      setDefKey("");
      setDefName("");
      await loadDefinitions();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create entitlement definition.");
    } finally {
      setCreatingDefinition(false);
    }
  }

  async function handleCreateGrant(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId || !applicationId || !entitlementDefinitionId) return;
    setCreatingGrant(true);
    setError(null);
    setActionMessage(null);
    try {
      await authedFetch(`/organizations/${selectedOrgId}/entitlement-grants`, {
        method: "POST",
        body: JSON.stringify({
          applicationId,
          entitlementDefinitionId,
          source,
          boolValue: boolValue || undefined,
          numberValue: numberValue !== "" ? Number(numberValue) : undefined,
          textValue: textValue || undefined,
          isUnlimited: isUnlimited || undefined,
          validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
        }),
      });
      setNumberValue("");
      setTextValue("");
      setBoolValue(false);
      setIsUnlimited(false);
      setValidUntil("");
      setActionMessage("Grant created.");
      await loadGrants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create entitlement grant.");
    } finally {
      setCreatingGrant(false);
    }
  }

  async function handleRevoke(grantId: string) {
    setActionMessage(null);
    try {
      await authedFetch(`/entitlement-grants/${grantId}`, { method: "DELETE" });
      setActionMessage("Grant revoked.");
      await loadGrants();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke grant.");
    }
  }

  async function handleCheck() {
    if (!selectedOrgId || !applicationId || !testerKey) return;
    setTesterBusy(true);
    setTesterError(null);
    setCheckResult(null);
    try {
      const data = await authedFetch<EntitlementCheckResult>(
        `/organizations/${selectedOrgId}/applications/${applicationId}/entitlements/${encodeURIComponent(testerKey)}/check`,
      );
      setCheckResult(data);
    } catch (err) {
      setTesterError(err instanceof ApiError ? err.message : "Could not run check.");
    } finally {
      setTesterBusy(false);
    }
  }

  async function handleUsage() {
    if (!selectedOrgId || !applicationId || !testerKey) return;
    setTesterBusy(true);
    setTesterError(null);
    setUsageResult(null);
    try {
      const data = await authedFetch<UsageSnapshot>(
        `/organizations/${selectedOrgId}/applications/${applicationId}/entitlements/${encodeURIComponent(testerKey)}/usage`,
      );
      setUsageResult(data);
    } catch (err) {
      setTesterError(err instanceof ApiError ? err.message : "Could not load usage.");
    } finally {
      setTesterBusy(false);
    }
  }

  async function handleIncrement() {
    if (!selectedOrgId || !applicationId || !testerKey) return;
    setTesterBusy(true);
    setTesterError(null);
    try {
      const data = await authedFetch<UsageSnapshot>(
        `/organizations/${selectedOrgId}/applications/${applicationId}/entitlements/${encodeURIComponent(testerKey)}/usage/increment`,
        {
          method: "POST",
          body: JSON.stringify({ amount: Number(testerIncrementAmount) || 1 }),
        },
      );
      setUsageResult(data);
    } catch (err) {
      setTesterError(err instanceof ApiError ? err.message : "Could not increment usage.");
    } finally {
      setTesterBusy(false);
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
        <h1 className="text-2xl font-semibold text-slate-900">Entitlements</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manual grants and runtime checks for{" "}
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
            <CardTitle>Grants</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : grants.length === 0 ? (
              <p className="text-sm text-slate-500">
                No entitlement grants yet for this application.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Valid until</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grants.map((grant) => (
                    <TableRow key={grant.id}>
                      <TableCell className="font-mono text-xs">
                        {grant.entitlementDefinition?.key ?? grant.entitlementDefinitionId}
                      </TableCell>
                      <TableCell>{grant.source}</TableCell>
                      <TableCell>
                        <Badge variant={grant.status === "ACTIVE" ? "success" : "outline"}>
                          {grant.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {grant.isUnlimited
                          ? "Unlimited"
                          : (grant.numberValue ??
                            grant.textValue ??
                            String(grant.boolValue ?? "—"))}
                      </TableCell>
                      <TableCell>
                        {grant.validUntil ? new Date(grant.validUntil).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        {grant.status === "ACTIVE" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRevoke(grant.id)}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-medium text-slate-700">Create manual grant</h3>
              {definitions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No entitlement definitions exist yet for this application - create one below
                  first.
                </p>
              ) : (
                <form onSubmit={handleCreateGrant} className="mt-3 flex flex-col gap-3" noValidate>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="grantDefinition">Entitlement</Label>
                      <Select
                        id="grantDefinition"
                        value={entitlementDefinitionId}
                        onChange={(e) => setEntitlementDefinitionId(e.target.value)}
                      >
                        {definitions.map((def) => (
                          <option key={def.id} value={def.id}>
                            {def.key}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="grantSource">Source</Label>
                      <Select
                        id="grantSource"
                        value={source}
                        onChange={(e) => setSource(e.target.value as EntitlementGrantSource)}
                      >
                        {ENTITLEMENT_GRANT_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="grantValidUntil">Valid until</Label>
                      <Input
                        id="grantValidUntil"
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="grantNumberValue">Number value</Label>
                      <Input
                        id="grantNumberValue"
                        type="number"
                        value={numberValue}
                        onChange={(e) => setNumberValue(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <Label htmlFor="grantTextValue">Text value</Label>
                      <Input
                        id="grantTextValue"
                        value={textValue}
                        onChange={(e) => setTextValue(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="flex items-end gap-4 pb-2">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={boolValue}
                          onChange={(e) => setBoolValue(e.target.checked)}
                        />
                        Bool value
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={isUnlimited}
                          onChange={(e) => setIsUnlimited(e.target.checked)}
                        />
                        Unlimited
                      </label>
                    </div>
                  </div>
                  <Button type="submit" disabled={creatingGrant || !entitlementDefinitionId}>
                    {creatingGrant ? "Creating..." : "Create grant"}
                  </Button>
                </form>
              )}

              <form
                onSubmit={handleCreateDefinition}
                className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4"
                noValidate
              >
                <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  New entitlement definition
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="defKey">Key</Label>
                    <Input
                      id="defKey"
                      required
                      maxLength={100}
                      value={defKey}
                      onChange={(e) => setDefKey(e.target.value)}
                      placeholder="api_access"
                    />
                  </div>
                  <div>
                    <Label htmlFor="defName">Name</Label>
                    <Input
                      id="defName"
                      required
                      maxLength={150}
                      value={defName}
                      onChange={(e) => setDefName(e.target.value)}
                      placeholder="API Access"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={creatingDefinition || !applicationId}
                    >
                      {creatingDefinition ? "Creating..." : "Create definition"}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Runtime check tester</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">
              Enter an entitlement key to exercise the same read path the SDK uses at request time.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="w-48">
                <Label htmlFor="testerKey">Entitlement key</Label>
                <Input
                  id="testerKey"
                  value={testerKey}
                  onChange={(e) => setTesterKey(e.target.value)}
                  placeholder="api_access"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={testerBusy || !testerKey}
                onClick={() => void handleCheck()}
              >
                Check
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={testerBusy || !testerKey}
                onClick={() => void handleUsage()}
              >
                Get usage
              </Button>
              <div className="w-24">
                <Label htmlFor="testerAmount">Amount</Label>
                <Input
                  id="testerAmount"
                  type="number"
                  value={testerIncrementAmount}
                  onChange={(e) => setTesterIncrementAmount(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={testerBusy || !testerKey}
                onClick={() => void handleIncrement()}
              >
                Increment
              </Button>
            </div>

            {testerError ? (
              <Alert variant="destructive" className="mt-4">
                {testerError}
              </Alert>
            ) : null}

            {checkResult ? (
              <div className="mt-4 rounded-md border border-slate-100 p-3 text-sm">
                <p>
                  <span className="font-medium">Allowed:</span>{" "}
                  <Badge variant={checkResult.allowed ? "success" : "destructive"}>
                    {String(checkResult.allowed)}
                  </Badge>
                </p>
                <p className="mt-1 text-slate-600">
                  numberValue: {checkResult.numberValue ?? "—"} · textValue:{" "}
                  {checkResult.textValue ?? "—"} · isUnlimited: {String(checkResult.isUnlimited)}
                </p>
              </div>
            ) : null}

            {usageResult ? (
              <div className="mt-4 rounded-md border border-slate-100 p-3 text-sm text-slate-600">
                used: {usageResult.used} · limit: {usageResult.limit ?? "—"} · remaining:{" "}
                {usageResult.remaining ?? "—"} · isUnlimited: {String(usageResult.isUnlimited)}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function EntitlementsPage() {
  return (
    <ProtectedRoute>
      <EntitlementsContent />
    </ProtectedRoute>
  );
}
