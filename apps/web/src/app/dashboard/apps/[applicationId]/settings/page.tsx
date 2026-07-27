"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
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
  Textarea,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../../components/protected-route";
import { DashboardNav } from "../../../../../components/dashboard-nav";
import { AppNav } from "../../../../../components/app-nav";
import { useAuth } from "../../../../../lib/auth-context";
import { useOrg } from "../../../../../lib/org-context";
import { ApiError } from "../../../../../lib/api-client";
import type {
  Application,
  ApplicationSetting,
  ApplicationVisibility,
} from "../../../../../lib/applications-types";

function ApplicationSettingsContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [app, setApp] = useState<Application | null>(null);
  const [settings, setSettings] = useState<ApplicationSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState<ApplicationVisibility>("PRIVATE");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [settingKey, setSettingKey] = useState("");
  const [settingValue, setSettingValue] = useState("");
  const [settingSaving, setSettingSaving] = useState(false);
  const [settingError, setSettingError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    try {
      const [appData, settingsData] = await Promise.all([
        authedFetch<Application>(`/organizations/${selectedOrgId}/applications/${applicationId}`),
        authedFetch<ApplicationSetting[]>(`/applications/${applicationId}/settings`),
      ]);
      setApp(appData);
      setName(appData.name);
      setDisplayName(appData.displayName ?? "");
      setDescription(appData.description ?? "");
      setCategory(appData.category ?? "");
      setVisibility(appData.visibility);
      setSettings(settingsData);
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSaveDetails(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setSaveError(null);
    setSaveMessage(null);
    setSaving(true);
    try {
      await authedFetch(`/organizations/${selectedOrgId}/applications/${applicationId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, displayName, description, category, visibility }),
      });
      setSaveMessage("Application details saved.");
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save application.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSetting(event: FormEvent) {
    event.preventDefault();
    setSettingError(null);
    setSettingSaving(true);
    try {
      let parsed: unknown = settingValue;
      try {
        parsed = JSON.parse(settingValue);
      } catch {
        // not valid JSON - treat as a plain string value
      }
      await authedFetch(
        `/applications/${applicationId}/settings/${encodeURIComponent(settingKey)}`,
        {
          method: "PUT",
          body: JSON.stringify({ value: parsed }),
        },
      );
      setSettingKey("");
      setSettingValue("");
      await load();
    } catch (err) {
      setSettingError(err instanceof ApiError ? err.message : "Could not save setting.");
    } finally {
      setSettingSaving(false);
    }
  }

  async function handleRemoveSetting(key: string) {
    await authedFetch(`/applications/${applicationId}/settings/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <AppNav applicationId={applicationId} />
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

        {loading || !app ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Application details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveDetails} className="flex flex-col gap-4" noValidate>
                  {saveError ? <Alert variant="destructive">{saveError}</Alert> : null}
                  {saveMessage ? <Alert variant="success">{saveMessage}</Alert> : null}

                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="displayName">Display name</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Input
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="visibility">Visibility</Label>
                    <Select
                      id="visibility"
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as ApplicationVisibility)}
                    >
                      <option value="PRIVATE">Private</option>
                      <option value="INTERNAL">Internal</option>
                    </Select>
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Custom settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-xs text-slate-500">
                  Key/value settings such as maintenance mode, public registration, support email,
                  theme, or branding. Values are parsed as JSON when possible (e.g.{" "}
                  <code>true</code>, <code>&quot;on&quot;</code>), otherwise stored as text.
                </p>

                {settings.length === 0 ? (
                  <p className="text-sm text-slate-500">No custom settings yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {settings.map((setting) => (
                      <li
                        key={setting.key}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium text-slate-900">{setting.key}</span>
                          <span className="ml-2 text-slate-500">
                            {JSON.stringify(setting.value)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRemoveSetting(setting.key)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  onSubmit={handleAddSetting}
                  className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
                  noValidate
                >
                  {settingError ? <Alert variant="destructive">{settingError}</Alert> : null}
                  <div className="flex-1">
                    <Label htmlFor="settingKey">Key</Label>
                    <Input
                      id="settingKey"
                      required
                      value={settingKey}
                      onChange={(e) => setSettingKey(e.target.value)}
                      placeholder="maintenanceMode"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="settingValue">Value</Label>
                    <Input
                      id="settingValue"
                      required
                      value={settingValue}
                      onChange={(e) => setSettingValue(e.target.value)}
                      placeholder="true"
                    />
                  </div>
                  <Button type="submit" disabled={settingSaving}>
                    {settingSaving ? "Saving..." : "Save setting"}
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

export default function ApplicationSettingsPage() {
  return (
    <ProtectedRoute>
      <ApplicationSettingsContent />
    </ProtectedRoute>
  );
}
