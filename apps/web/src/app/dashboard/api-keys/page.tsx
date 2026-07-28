"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Alert,
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
import type { APIClient } from "../../../lib/api-keys-types";

function ApiKeysContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [clients, setClients] = useState<APIClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [creating, setCreating] = useState(false);

  const loadApplications = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const data = await authedFetch<ApplicationListResult>(
        `/organizations/${selectedOrgId}/applications`,
      );
      setApplications(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applications.");
    }
  }, [authedFetch, selectedOrgId]);

  const loadClients = useCallback(async () => {
    if (!selectedOrgId) {
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<APIClient[]>(`/organizations/${selectedOrgId}/api-clients`);
      setClients(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load API clients.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setCreating(true);
    setError(null);
    try {
      await authedFetch(`/organizations/${selectedOrgId}/api-clients`, {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          applicationId: applicationId || undefined,
        }),
      });
      setName("");
      setDescription("");
      setApplicationId("");
      await loadClients();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create API client.");
    } finally {
      setCreating(false);
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
        <h1 className="text-2xl font-semibold text-slate-900">API Keys</h1>
        <p className="mt-1 text-sm text-slate-500">
          API clients and credentials for{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Clients</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : clients.length === 0 ? (
              <p className="text-sm text-slate-500">No API clients yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium text-slate-900">{client.name}</TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {client.applicationId ? "Application" : "Organization-wide"}
                      </TableCell>
                      <TableCell>{new Date(client.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/api-keys/${client.id}`}
                          className="text-sm font-medium text-slate-700 hover:text-slate-900"
                        >
                          Manage →
                        </Link>
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
                  <Label htmlFor="clientName">Name</Label>
                  <Input
                    id="clientName"
                    required
                    maxLength={200}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Internal integration"
                  />
                </div>
                <div>
                  <Label htmlFor="clientApplication">Application (optional)</Label>
                  <Select
                    id="clientApplication"
                    value={applicationId}
                    onChange={(e) => setApplicationId(e.target.value)}
                  >
                    <option value="">Organization-wide</option>
                    {applications?.items.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.displayName ?? app.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="clientDescription">Description</Label>
                  <Input
                    id="clientDescription"
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create client"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function ApiKeysPage() {
  return (
    <ProtectedRoute>
      <ApiKeysContent />
    </ProtectedRoute>
  );
}
