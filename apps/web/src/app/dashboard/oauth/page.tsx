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
} from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { CopyableSecret } from "../../../components/copyable-secret";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { ApplicationListResult } from "../../../lib/applications-types";
import type {
  OAuthApplication,
  OAuthApplicationCreated,
  OAuthCredentialCreated,
} from "../../../lib/oauth-types";

function OAuthContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");

  const [oauthApps, setOauthApps] = useState<OAuthApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<OAuthCredentialCreated | null>(null);

  const [newRedirectUri, setNewRedirectUri] = useState<Record<string, string>>({});
  const [newCallbackUrl, setNewCallbackUrl] = useState<Record<string, string>>({});
  const [rotatedSecret, setRotatedSecret] = useState<Record<string, OAuthCredentialCreated>>({});

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

  const loadOauthApps = useCallback(async () => {
    if (!applicationId) {
      setOauthApps([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<OAuthApplication[]>(
        `/applications/${applicationId}/oauth-applications`,
      );
      setOauthApps(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load OAuth applications.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void loadOauthApps();
  }, [loadOauthApps]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!applicationId || !name) return;
    setCreating(true);
    setError(null);
    setCreatedSecret(null);
    try {
      const created = await authedFetch<OAuthApplicationCreated>(
        `/applications/${applicationId}/oauth-applications`,
        { method: "POST", body: JSON.stringify({ name }) },
      );
      setCreatedSecret(created.credentials[0] ?? null);
      setName("");
      await loadOauthApps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create OAuth application.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(oauthApplicationId: string) {
    setError(null);
    try {
      await authedFetch(`/applications/${applicationId}/oauth-applications/${oauthApplicationId}`, {
        method: "DELETE",
      });
      await loadOauthApps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete OAuth application.");
    }
  }

  async function handleRotateCredential(oauthApplicationId: string, credentialId: string) {
    setError(null);
    try {
      const secret = await authedFetch<OAuthCredentialCreated>(
        `/oauth-applications/${oauthApplicationId}/credentials/${credentialId}/rotate`,
        { method: "PATCH" },
      );
      setRotatedSecret((prev) => ({ ...prev, [oauthApplicationId]: secret }));
      await loadOauthApps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rotate credential.");
    }
  }

  async function handleAddCredential(oauthApplicationId: string) {
    setError(null);
    try {
      const secret = await authedFetch<OAuthCredentialCreated>(
        `/oauth-applications/${oauthApplicationId}/credentials`,
        { method: "POST" },
      );
      setRotatedSecret((prev) => ({ ...prev, [oauthApplicationId]: secret }));
      await loadOauthApps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create credential.");
    }
  }

  async function handleRevokeCredential(oauthApplicationId: string, credentialId: string) {
    setError(null);
    try {
      await authedFetch(`/oauth-applications/${oauthApplicationId}/credentials/${credentialId}`, {
        method: "DELETE",
      });
      await loadOauthApps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke credential.");
    }
  }

  async function handleAddRedirectUri(oauthApplicationId: string) {
    const uri = newRedirectUri[oauthApplicationId];
    if (!uri) return;
    setError(null);
    try {
      await authedFetch(`/oauth-applications/${oauthApplicationId}/redirect-uris`, {
        method: "POST",
        body: JSON.stringify({ uri }),
      });
      setNewRedirectUri((prev) => ({ ...prev, [oauthApplicationId]: "" }));
      await loadOauthApps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add redirect URI.");
    }
  }

  async function handleRemoveRedirectUri(oauthApplicationId: string, redirectUriId: string) {
    setError(null);
    try {
      await authedFetch(
        `/oauth-applications/${oauthApplicationId}/redirect-uris/${redirectUriId}`,
        { method: "DELETE" },
      );
      await loadOauthApps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove redirect URI.");
    }
  }

  async function handleAddCallbackUrl(oauthApplicationId: string) {
    const url = newCallbackUrl[oauthApplicationId];
    if (!url) return;
    setError(null);
    try {
      await authedFetch(`/oauth-applications/${oauthApplicationId}/callback-urls`, {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      setNewCallbackUrl((prev) => ({ ...prev, [oauthApplicationId]: "" }));
      await loadOauthApps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add callback URL.");
    }
  }

  async function handleRemoveCallbackUrl(oauthApplicationId: string, callbackUrlId: string) {
    setError(null);
    try {
      await authedFetch(
        `/oauth-applications/${oauthApplicationId}/callback-urls/${callbackUrlId}`,
        {
          method: "DELETE",
        },
      );
      await loadOauthApps();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove callback URL.");
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
        <h1 className="text-2xl font-semibold text-slate-900">OAuth Applications</h1>
        <p className="mt-1 text-sm text-slate-500">
          OAuth client registrations for{" "}
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
          <CardHeader>
            <CardTitle>Create OAuth application</CardTitle>
          </CardHeader>
          <CardContent>
            {createdSecret ? (
              <Alert className="mb-4">
                <p className="font-medium">
                  Client secret - copy it now, it will not be shown again.
                </p>
                <p className="mt-1 font-mono text-xs">Client ID: {createdSecret.clientId}</p>
                <div className="mt-2">
                  <CopyableSecret value={createdSecret.plainText} />
                </div>
              </Alert>
            ) : null}
            <form
              onSubmit={handleCreate}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              noValidate
            >
              <div className="flex-1">
                <Label htmlFor="oauthName">Name</Label>
                <Input
                  id="oauthName"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Web login"
                />
              </div>
              <Button type="submit" disabled={creating || !name}>
                {creating ? "Creating..." : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : oauthApps.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No OAuth applications yet.</p>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {oauthApps.map((app) => (
              <Card key={app.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-slate-900">
                    <span className="text-base font-semibold">{app.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => void handleDelete(app.id)}>
                      Delete
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rotatedSecret[app.id] ? (
                    <Alert className="mb-4">
                      <p className="font-medium">
                        New secret - copy it now, it will not be shown again.
                      </p>
                      <div className="mt-2">
                        <CopyableSecret value={rotatedSecret[app.id]!.plainText} />
                      </div>
                    </Alert>
                  ) : null}

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Credentials
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      {app.credentials.map((cred) => (
                        <div
                          key={cred.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 p-3"
                        >
                          <div>
                            <p className="font-mono text-xs text-slate-700">
                              {cred.clientId} •••• {cred.lastFour}
                            </p>
                            <Badge variant={cred.revokedAt ? "destructive" : "success"}>
                              {cred.revokedAt ? "REVOKED" : "ACTIVE"}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={Boolean(cred.revokedAt)}
                              onClick={() => void handleRotateCredential(app.id, cred.id)}
                            >
                              Rotate
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={Boolean(cred.revokedAt)}
                              onClick={() => void handleRevokeCredential(app.id, cred.id)}
                            >
                              Revoke
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => void handleAddCredential(app.id)}
                    >
                      Add credential
                    </Button>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Redirect URIs
                    </p>
                    <div className="mt-2 flex flex-col gap-1">
                      {app.redirectUris.map((uri) => (
                        <div key={uri.id} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">{uri.uri}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRemoveRedirectUri(app.id, uri.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        className="h-9"
                        placeholder="https://app.example.com/oauth/callback"
                        value={newRedirectUri[app.id] ?? ""}
                        onChange={(e) =>
                          setNewRedirectUri((prev) => ({ ...prev, [app.id]: e.target.value }))
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!newRedirectUri[app.id]}
                        onClick={() => void handleAddRedirectUri(app.id)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Callback URLs
                    </p>
                    <div className="mt-2 flex flex-col gap-1">
                      {app.callbackUrls.map((url) => (
                        <div key={url.id} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">{url.url}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRemoveCallbackUrl(app.id, url.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input
                        className="h-9"
                        placeholder="myapp://auth-callback"
                        value={newCallbackUrl[app.id] ?? ""}
                        onChange={(e) =>
                          setNewCallbackUrl((prev) => ({ ...prev, [app.id]: e.target.value }))
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!newCallbackUrl[app.id]}
                        onClick={() => void handleAddCallbackUrl(app.id)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default function OAuthPage() {
  return (
    <ProtectedRoute>
      <OAuthContent />
    </ProtectedRoute>
  );
}
