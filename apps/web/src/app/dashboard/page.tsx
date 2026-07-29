"use client";

import { useState, type FormEvent } from "react";
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
} from "@paywall/ui";
import { ProtectedRoute } from "../../components/protected-route";
import { DashboardNav } from "../../components/dashboard-nav";
import { OrgSwitcher } from "../../components/org-switcher";
import { useAuth } from "../../lib/auth-context";
import { useOrg } from "../../lib/org-context";
import { ApiError } from "../../lib/api-client";

function DashboardContent() {
  const { user, authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, loading, selectOrg, refresh } = useOrg();
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateOrg(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await authedFetch("/organizations", {
        method: "POST",
        body: JSON.stringify({ name: newOrgName }),
      });
      setNewOrgName("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create organization.");
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
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome, {user?.displayName ?? user?.email}
        </h1>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <h2 className="mb-3 text-lg font-medium text-slate-900">Your organizations</h2>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : organizations.length === 0 ? (
              <p className="text-sm text-slate-500">
                You don&apos;t belong to any organizations yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {organizations.map((org) => (
                  <Card key={org.id}>
                    <CardHeader>
                      <CardTitle>{org.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">/{org.slug}</span>
                      <Badge variant="outline">{org.role}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {selectedOrg ? (
              <p className="mt-3 text-xs text-slate-400">
                Currently switched to <span className="font-medium">{selectedOrg.name}</span>.
              </p>
            ) : null}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-medium text-slate-900">Create an organization</h2>
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateOrg} className="flex flex-col gap-3" noValidate>
                  {error ? <Alert variant="destructive">{error}</Alert> : null}
                  <div>
                    <Label htmlFor="orgName">Name</Label>
                    <Input
                      id="orgName"
                      required
                      minLength={2}
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Creating..." : "Create organization"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
