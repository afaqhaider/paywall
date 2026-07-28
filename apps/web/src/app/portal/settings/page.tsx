"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { PortalNav } from "../../../components/portal-nav";
import { CustomerSwitcher } from "../../../components/customer-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useCustomer } from "../../../lib/customer-context";
import { ApiError } from "../../../lib/api-client";
import type { CustomerSettings } from "../../../lib/customer-portal-types";

function SettingsContent() {
  const { authedFetch } = useAuth();
  const { customers, selectedCustomerId, selectCustomer } = useCustomer();
  const [settings, setSettings] = useState<CustomerSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authedFetch<CustomerSettings>("/customer-portal/me/settings")
      .then(setSettings)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Could not load your settings.");
      });
  }, [authedFetch]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const updated = await authedFetch<CustomerSettings>("/customer-portal/me/settings", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: settings.firstName,
          lastName: settings.lastName,
          displayName: settings.displayName,
          timezone: settings.timezone,
          language: settings.language,
          country: settings.country,
          phone: settings.phone,
        }),
      });
      setSettings(updated);
      setMessage("Settings updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PortalNav>
        <CustomerSwitcher
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelect={selectCustomer}
        />
      </PortalNav>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {!settings ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Personal information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
                {message ? <Alert variant="success">{message}</Alert> : null}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={settings.firstName ?? ""}
                      onChange={(e) => setSettings({ ...settings, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={settings.lastName ?? ""}
                      onChange={(e) => setSettings({ ...settings, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="displayName">Display name</Label>
                  <Input
                    id="displayName"
                    value={settings.displayName ?? ""}
                    onChange={(e) => setSettings({ ...settings, displayName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={settings.email} disabled />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Input
                      id="language"
                      value={settings.language}
                      onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      maxLength={2}
                      placeholder="US"
                      value={settings.country ?? ""}
                      onChange={(e) =>
                        setSettings({ ...settings, country: e.target.value.toUpperCase() })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={settings.phone ?? ""}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={saving} className="w-fit">
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
