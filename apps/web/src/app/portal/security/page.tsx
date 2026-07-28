"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { PortalNav } from "../../../components/portal-nav";
import { CustomerSwitcher } from "../../../components/customer-switcher";
import { CopyableSecret } from "../../../components/copyable-secret";
import { useAuth } from "../../../lib/auth-context";
import { useCustomer } from "../../../lib/customer-context";
import { ApiError } from "../../../lib/api-client";
import type {
  CustomerSecurityInfo,
  TwoFactorSetupResult,
  TwoFactorVerifyResult,
} from "../../../lib/customer-portal-types";

function SecurityContent() {
  const { authedFetch } = useAuth();
  const { customers, selectedCustomerId, selectCustomer } = useCustomer();

  const [info, setInfo] = useState<CustomerSecurityInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // 2FA setup wizard
  const [setupData, setSetupData] = useState<TwoFactorSetupResult | null>(null);
  const [setupStarting, setSetupStarting] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [twoFaError, setTwoFaError] = useState<string | null>(null);

  // 2FA disable
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CustomerSecurityInfo>("/customer-portal/me/security");
      setInfo(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load security settings.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordSaving(true);
    try {
      const res = await authedFetch<{ message: string }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordMessage(res.message);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Could not change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleStartSetup() {
    setTwoFaError(null);
    setSetupStarting(true);
    try {
      const data = await authedFetch<TwoFactorSetupResult>(
        "/customer-portal/me/security/two-factor/setup",
        { method: "POST" },
      );
      setSetupData(data);
      setRecoveryCodes(null);
    } catch (err) {
      setTwoFaError(err instanceof ApiError ? err.message : "Could not start 2FA setup.");
    } finally {
      setSetupStarting(false);
    }
  }

  async function handleVerifySetup(event: FormEvent) {
    event.preventDefault();
    setTwoFaError(null);
    setVerifying(true);
    try {
      const result = await authedFetch<TwoFactorVerifyResult>(
        "/customer-portal/me/security/two-factor/verify",
        { method: "POST", body: JSON.stringify({ code: verifyCode }) },
      );
      setRecoveryCodes(result.recoveryCodes);
      setSetupData(null);
      setVerifyCode("");
      await load();
    } catch (err) {
      setTwoFaError(err instanceof ApiError ? err.message : "Invalid code. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleDisable(event: FormEvent) {
    event.preventDefault();
    setTwoFaError(null);
    setDisabling(true);
    try {
      await authedFetch("/customer-portal/me/security/two-factor/disable", {
        method: "POST",
        body: JSON.stringify({ code: disableCode }),
      });
      setDisableCode("");
      await load();
    } catch (err) {
      setTwoFaError(err instanceof ApiError ? err.message : "Could not disable 2FA.");
    } finally {
      setDisabling(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    setError(null);
    try {
      await authedFetch(`/auth/sessions/${sessionId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke this session.");
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
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Security</h1>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4" noValidate>
              {passwordError ? <Alert variant="destructive">{passwordError}</Alert> : null}
              {passwordMessage ? <Alert variant="success">{passwordMessage}</Alert> : null}
              <div>
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  required
                  minLength={12}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={passwordSaving} className="w-fit">
                {passwordSaving ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Two-factor authentication</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {twoFaError ? <Alert variant="destructive">{twoFaError}</Alert> : null}

            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : recoveryCodes ? (
              <div className="flex flex-col gap-3">
                <Alert variant="success">
                  Two-factor authentication is enabled. Save these recovery codes somewhere safe -
                  each can be used once if you lose access to your authenticator app. They will not
                  be shown again.
                </Alert>
                <div className="flex flex-col gap-2">
                  {recoveryCodes.map((code) => (
                    <CopyableSecret key={code} value={code} />
                  ))}
                </div>
              </div>
            ) : info?.twoFactorEnabled ? (
              <div className="flex flex-col gap-3">
                <Alert variant="success">Two-factor authentication is currently enabled.</Alert>
                <form onSubmit={handleDisable} className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label htmlFor="disableCode">Enter a code to disable 2FA</Label>
                    <Input
                      id="disableCode"
                      inputMode="numeric"
                      maxLength={6}
                      value={disableCode}
                      onChange={(e) =>
                        setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={disabling || disableCode.length !== 6}
                  >
                    {disabling ? "Disabling..." : "Disable 2FA"}
                  </Button>
                </form>
              </div>
            ) : setupData ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-slate-600">
                  Add this account to your authenticator app (Google Authenticator, 1Password,
                  Authy, etc.) by pasting the setup URL below, or entering the secret manually.
                </p>
                <div>
                  <Label>Setup URL</Label>
                  <CopyableSecret value={setupData.otpauthUrl} />
                </div>
                <div>
                  <Label>Secret key</Label>
                  <CopyableSecret value={setupData.secret} />
                </div>
                <form onSubmit={handleVerifySetup} className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label htmlFor="verifyCode">Enter the 6-digit code to confirm</Label>
                    <Input
                      id="verifyCode"
                      inputMode="numeric"
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>
                  <Button type="submit" disabled={verifying || verifyCode.length !== 6}>
                    {verifying ? "Verifying..." : "Enable 2FA"}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-600">
                  Two-factor authentication is currently disabled on your account.
                </p>
                <Button
                  className="w-fit"
                  disabled={setupStarting}
                  onClick={() => void handleStartSetup()}
                >
                  {setupStarting ? "Starting..." : "Set up two-factor authentication"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Active sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : !info || info.sessions.length === 0 ? (
              <p className="text-sm text-slate-500">No active sessions.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>IP address</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {info.sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <p>{session.deviceName ?? "Unknown device"}</p>
                        <p className="text-xs text-slate-400">{session.userAgent ?? ""}</p>
                      </TableCell>
                      <TableCell>{session.ipAddress ?? "—"}</TableCell>
                      <TableCell>{new Date(session.lastUsedAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRevokeSession(session.id)}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : !info || info.recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500">No recent activity.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm text-slate-700">
                {info.recentActivity.map((activity, index) => (
                  <li key={index} className="border-b border-slate-100 pb-2 last:border-0">
                    <p>{activity.action}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function SecurityPage() {
  return (
    <ProtectedRoute>
      <SecurityContent />
    </ProtectedRoute>
  );
}
