"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { UpdateWhiteLabelInput, WhiteLabelConfig } from "../../../lib/white-label-types";

function WhiteLabelContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();

  const [config, setConfig] = useState<WhiteLabelConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [logoUrl, setLogoUrl] = useState("");
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [emailFromName, setEmailFromName] = useState("");

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<WhiteLabelConfig | null>(
        `/organizations/${selectedOrgId}/white-label`,
      );
      setConfig(data);
      setLogoUrl(data?.logoUrl ?? "");
      setBrandName(data?.brandName ?? "");
      setPrimaryColor(data?.primaryColor ?? "");
      setSecondaryColor(data?.secondaryColor ?? "");
      setCustomDomain(data?.customDomain ?? "");
      setEmailFromName(data?.emailFromName ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load white-label settings.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedOrgId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const input: UpdateWhiteLabelInput = {
        logoUrl: logoUrl || undefined,
        brandName: brandName || undefined,
        primaryColor: primaryColor || undefined,
        secondaryColor: secondaryColor || undefined,
        customDomain: customDomain || undefined,
        emailFromName: emailFromName || undefined,
      };
      const data = await authedFetch<WhiteLabelConfig>(
        `/organizations/${selectedOrgId}/white-label`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
        },
      );
      setConfig(data);
      setMessage("White-label settings saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save white-label settings.");
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
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">White-label Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Branding applied to{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>&apos;s
          customer-facing surfaces (customer portal, marketplace listing, outbound emails).
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {message ? (
          <Alert variant="success" className="mt-4">
            {message}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Branding</CardTitle>
            </CardHeader>
            <CardContent>
              {!config ? (
                <p className="mb-4 text-xs text-slate-500">
                  Not configured yet - platform defaults are used until you save settings here.
                </p>
              ) : null}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                <div>
                  <Label htmlFor="brandName">Brand name</Label>
                  <Input
                    id="brandName"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    maxLength={150}
                  />
                </div>
                <div>
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://cdn.example.com/logo.png"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="primaryColor">Primary color</Label>
                    <Input
                      id="primaryColor"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#336699"
                    />
                  </div>
                  <div>
                    <Label htmlFor="secondaryColor">Secondary color</Label>
                    <Input
                      id="secondaryColor"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#336699"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="customDomain">Custom domain</Label>
                  <Input
                    id="customDomain"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="portal.yourbrand.com"
                  />
                </div>
                <div>
                  <Label htmlFor="emailFromName">Email sender name</Label>
                  <Input
                    id="emailFromName"
                    value={emailFromName}
                    onChange={(e) => setEmailFromName(e.target.value)}
                    maxLength={150}
                  />
                </div>
                <Button type="submit" disabled={saving} className="self-start">
                  {saving ? "Saving..." : "Save settings"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}

export default function WhiteLabelPage() {
  return (
    <ProtectedRoute>
      <WhiteLabelContent />
    </ProtectedRoute>
  );
}
