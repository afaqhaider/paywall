"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import type {
  PaymentProvider,
  PaymentProviderStatus,
  ProviderAccount,
  ProviderCredentialMetadata,
} from "../../../../lib/payments-types";

function ProviderDetailContent() {
  const { providerId } = useParams<{ providerId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<PaymentProviderStatus>("ACTIVE");
  const [saving, setSaving] = useState(false);

  const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [externalAccountId, setExternalAccountId] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  const [credentials, setCredentials] = useState<ProviderCredentialMetadata[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [credentialKey, setCredentialKey] = useState("");
  const [credentialValue, setCredentialValue] = useState("");
  const [savingCredential, setSavingCredential] = useState(false);

  const loadProvider = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PaymentProvider>(
        `/organizations/${selectedOrgId}/payment-providers/${providerId}`,
      );
      setProvider(data);
      setDisplayName(data.displayName);
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load payment provider.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, providerId]);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await authedFetch<ProviderAccount[]>(
        `/payment-providers/${providerId}/accounts`,
      );
      setAccounts(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load connected accounts.");
    } finally {
      setAccountsLoading(false);
    }
  }, [authedFetch, providerId]);

  const loadCredentials = useCallback(async () => {
    setCredentialsLoading(true);
    try {
      const data = await authedFetch<ProviderCredentialMetadata[]>(
        `/payment-providers/${providerId}/credentials`,
      );
      setCredentials(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load credentials.");
    } finally {
      setCredentialsLoading(false);
    }
  }, [authedFetch, providerId]);

  useEffect(() => {
    void loadProvider();
  }, [loadProvider]);

  useEffect(() => {
    void loadAccounts();
    void loadCredentials();
  }, [loadAccounts, loadCredentials]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setSaving(true);
    setActionMessage(null);
    setError(null);
    try {
      const updated = await authedFetch<PaymentProvider>(
        `/organizations/${selectedOrgId}/payment-providers/${providerId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ displayName, status }),
        },
      );
      setProvider(updated);
      setActionMessage("Provider updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update provider.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!selectedOrgId) return;
    setActionMessage(null);
    setError(null);
    try {
      const updated = await authedFetch<PaymentProvider>(
        `/organizations/${selectedOrgId}/payment-providers/${providerId}/archive`,
        { method: "POST" },
      );
      setProvider(updated);
      setStatus(updated.status);
      setActionMessage("Provider archived.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not archive provider.");
    }
  }

  async function handleCreateAccount(event: FormEvent) {
    event.preventDefault();
    setCreatingAccount(true);
    setError(null);
    try {
      await authedFetch(`/payment-providers/${providerId}/accounts`, {
        method: "POST",
        body: JSON.stringify({
          externalAccountId,
          label: accountLabel || undefined,
        }),
      });
      setExternalAccountId("");
      setAccountLabel("");
      await loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add connected account.");
    } finally {
      setCreatingAccount(false);
    }
  }

  async function handleUpsertCredential(event: FormEvent) {
    event.preventDefault();
    setSavingCredential(true);
    setError(null);
    try {
      await authedFetch(`/payment-providers/${providerId}/credentials`, {
        method: "POST",
        body: JSON.stringify({ key: credentialKey, value: credentialValue }),
      });
      setCredentialKey("");
      setCredentialValue("");
      await loadCredentials();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save credential.");
    } finally {
      setSavingCredential(false);
    }
  }

  async function handleRemoveCredential(credentialId: string) {
    setError(null);
    try {
      await authedFetch(`/payment-providers/${providerId}/credentials/${credentialId}`, {
        method: "DELETE",
      });
      await loadCredentials();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove credential.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/dashboard/payment-providers"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Payment providers
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        {loading || !provider ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{provider.displayName}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {provider.type} / {provider.environment}
                </p>
              </div>
              <Badge variant={provider.status === "ACTIVE" ? "success" : "outline"}>
                {provider.status}
              </Badge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="displayName">Display name</Label>
                      <Input
                        id="displayName"
                        required
                        maxLength={150}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status</Label>
                      <Select
                        id="status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as PaymentProviderStatus)}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="DISABLED">DISABLED</option>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                    {provider.status === "ACTIVE" ? (
                      <Button type="button" variant="outline" onClick={handleArchive}>
                        Archive provider
                      </Button>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Connected accounts</CardTitle>
              </CardHeader>
              <CardContent>
                {accountsLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : accounts.length === 0 ? (
                  <p className="text-sm text-slate-500">No connected accounts yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>External account ID</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-mono text-xs">
                            {account.externalAccountId}
                          </TableCell>
                          <TableCell>{account.label ?? "—"}</TableCell>
                          <TableCell>{new Date(account.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <form
                  onSubmit={handleCreateAccount}
                  className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
                  noValidate
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="externalAccountId">External account ID</Label>
                      <Input
                        id="externalAccountId"
                        required
                        maxLength={255}
                        value={externalAccountId}
                        onChange={(e) => setExternalAccountId(e.target.value)}
                        placeholder="acct_123"
                      />
                    </div>
                    <div>
                      <Label htmlFor="accountLabel">Label</Label>
                      <Input
                        id="accountLabel"
                        maxLength={255}
                        value={accountLabel}
                        onChange={(e) => setAccountLabel(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={creatingAccount} className="w-fit">
                    {creatingAccount ? "Adding..." : "Add account"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Credentials</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-xs text-slate-500">
                  Secret values are never shown after they&apos;re saved - only the key, last four
                  characters, and rotation timestamp.
                </p>
                {credentialsLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : credentials.length === 0 ? (
                  <p className="text-sm text-slate-500">No credentials yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Last four</TableHead>
                        <TableHead>Rotated</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {credentials.map((credential) => (
                        <TableRow key={credential.id}>
                          <TableCell className="font-mono text-xs">{credential.key}</TableCell>
                          <TableCell>
                            {credential.lastFour ? `••••${credential.lastFour}` : "—"}
                          </TableCell>
                          <TableCell>
                            {credential.rotatedAt
                              ? new Date(credential.rotatedAt).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleRemoveCredential(credential.id)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <form
                  onSubmit={handleUpsertCredential}
                  className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
                  noValidate
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="credentialKey">Key</Label>
                      <Input
                        id="credentialKey"
                        required
                        maxLength={100}
                        value={credentialKey}
                        onChange={(e) => setCredentialKey(e.target.value)}
                        placeholder="SECRET_KEY"
                      />
                    </div>
                    <div>
                      <Label htmlFor="credentialValue">Value</Label>
                      <Input
                        id="credentialValue"
                        required
                        type="password"
                        maxLength={8000}
                        value={credentialValue}
                        onChange={(e) => setCredentialValue(e.target.value)}
                        placeholder="Enter a new value to add or rotate"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={savingCredential} className="w-fit">
                    {savingCredential ? "Saving..." : "Save credential"}
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

export default function ProviderDetailPage() {
  return (
    <ProtectedRoute>
      <ProviderDetailContent />
    </ProtectedRoute>
  );
}
