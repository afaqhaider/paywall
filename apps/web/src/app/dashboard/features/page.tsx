"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
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
  Textarea,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { ApplicationListResult } from "../../../lib/applications-types";
import { FEATURE_TYPES, type Feature, type FeatureType } from "../../../lib/features-types";

function FeaturesListContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");

  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<FeatureType>("BOOLEAN");
  const [unit, setUnit] = useState("");
  const [creating, setCreating] = useState(false);

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

  const loadFeatures = useCallback(async () => {
    if (!applicationId) {
      setFeatures([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<Feature[]>(`/applications/${applicationId}/features`);
      setFeatures(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load features.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void loadFeatures();
  }, [loadFeatures]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!applicationId) return;
    setCreating(true);
    setError(null);
    try {
      await authedFetch(`/applications/${applicationId}/features`, {
        method: "POST",
        body: JSON.stringify({
          key,
          name,
          description: description || undefined,
          type,
          unit: unit || undefined,
        }),
      });
      setKey("");
      setName("");
      setDescription("");
      setUnit("");
      await loadFeatures();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create feature.");
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(featureId: string) {
    try {
      await authedFetch(`/features/${featureId}/archive`, { method: "POST" });
      await loadFeatures();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not archive feature.");
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
        <h1 className="text-2xl font-semibold text-slate-900">Features</h1>
        <p className="mt-1 text-sm text-slate-500">
          Capabilities an application exposes to plans, for{" "}
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

        <Card className="mt-6">
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : features.length === 0 ? (
              <p className="text-sm text-slate-500">No features yet for this application.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {features.map((feature) => (
                    <TableRow key={feature.id}>
                      <TableCell className="font-mono text-xs">{feature.key}</TableCell>
                      <TableCell className="font-medium text-slate-900">{feature.name}</TableCell>
                      <TableCell>{feature.type}</TableCell>
                      <TableCell>{feature.unit ?? "—"}</TableCell>
                      <TableCell>
                        {feature.archivedAt ? (
                          <Badge variant="outline">Archived</Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleArchive(feature.id)}
                          >
                            Archive
                          </Button>
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <Label htmlFor="featureKey">Key</Label>
                  <Input
                    id="featureKey"
                    required
                    maxLength={100}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="api_access"
                  />
                </div>
                <div>
                  <Label htmlFor="featureName">Name</Label>
                  <Input
                    id="featureName"
                    required
                    maxLength={150}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="API Access"
                  />
                </div>
                <div>
                  <Label htmlFor="featureType">Type</Label>
                  <Select
                    id="featureType"
                    value={type}
                    onChange={(e) => setType(e.target.value as FeatureType)}
                  >
                    {FEATURE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="featureUnit">Unit</Label>
                  <Input
                    id="featureUnit"
                    maxLength={50}
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="seats, GB, calls..."
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="featureDescription">Description</Label>
                <Textarea
                  id="featureDescription"
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={creating || !applicationId}>
                {creating ? "Creating..." : "Create feature"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function FeaturesListPage() {
  return (
    <ProtectedRoute>
      <FeaturesListContent />
    </ProtectedRoute>
  );
}
