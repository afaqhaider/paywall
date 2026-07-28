"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { useAuth } from "../../../../lib/auth-context";
import { ApiError } from "../../../../lib/api-client";
import {
  adminCustomerStatusVariant,
  type AdminCustomerDetail,
} from "../../../../lib/admin-customers-types";
import type {
  ImpersonationTokenResponse,
  LoginLinkResponse,
} from "../../../../lib/admin-support-types";

function SectionTable<T>({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: T[] | undefined;
  columns: { label: string; render: (row: T) => React.ReactNode }[];
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>
          {title} ({rows?.length ?? 0})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!rows || rows.length === 0 ? (
          <p className="text-sm text-slate-500">None.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c.label}>{c.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.label}>{c.render(row)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminCustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const { authedFetch } = useAuth();

  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [targetRole, setTargetRole] = useState("CUSTOMER");
  const [lastImpersonation, setLastImpersonation] = useState<ImpersonationTokenResponse | null>(
    null,
  );
  const [lastLoginLink, setLastLoginLink] = useState<LoginLinkResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<AdminCustomerDetail>(`/admin/customers/${customerId}`);
      setCustomer(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load customer.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const userId = customer?.userId ?? customerId;

  async function runAction(action: string, fn: () => Promise<void>) {
    setActionBusy(action);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(`${action} succeeded.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${action.toLowerCase()}.`);
    } finally {
      setActionBusy(null);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <p className="mt-4 text-sm text-slate-500">Customer not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/admin/customers" className="text-sm text-slate-500 underline">
        Back to Customers
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">
          {customer.displayName ?? customer.email ?? customer.id}
        </h1>
        {customer.status ? (
          <Badge variant={adminCustomerStatusVariant(customer.status)}>{customer.status}</Badge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-slate-500">{customer.email ?? "no email on file"}</p>

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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Account Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={actionBusy !== null}
            onClick={() =>
              runAction("Suspend", async () => {
                await authedFetch(`/admin/customers/${customerId}/suspend`, { method: "POST" });
                await load();
              })
            }
          >
            Suspend
          </Button>
          <Button
            variant="outline"
            disabled={actionBusy !== null}
            onClick={() =>
              runAction("Reactivate", async () => {
                await authedFetch(`/admin/customers/${customerId}/reactivate`, { method: "POST" });
                await load();
              })
            }
          >
            Reactivate
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-6 border-amber-300">
        <CardHeader>
          <CardTitle className="text-amber-800">Support Tools</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-slate-500">
            Actions below operate on user account <span className="font-mono">{userId}</span>. All
            support actions are audit-logged.
          </p>
          <div>
            <Label htmlFor="reason">Reason (optional, recorded in audit log)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Customer requested help via ticket #1234"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t border-amber-100 pt-4">
            <div>
              <Label htmlFor="targetRole">Impersonate as role</Label>
              <Input
                id="targetRole"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-48"
              />
            </div>
            <Button
              variant="outline"
              disabled={actionBusy !== null}
              onClick={() =>
                runAction("Impersonate", async () => {
                  const res = await authedFetch<ImpersonationTokenResponse>(
                    `/admin/support/users/${userId}/impersonate`,
                    {
                      method: "POST",
                      body: JSON.stringify({ targetRole, reason: reason || undefined }),
                    },
                  );
                  setLastImpersonation(res);
                })
              }
            >
              Generate impersonation token
            </Button>
            <Button
              variant="outline"
              disabled={actionBusy !== null}
              onClick={() =>
                runAction("Generate login link", async () => {
                  const res = await authedFetch<LoginLinkResponse>(
                    `/admin/support/users/${userId}/login-link`,
                    { method: "POST", body: JSON.stringify({ reason: reason || undefined }) },
                  );
                  setLastLoginLink(res);
                })
              }
            >
              Generate login link
            </Button>
          </div>

          {lastImpersonation ? (
            <p className="break-all rounded bg-slate-50 p-2 text-xs">
              Impersonation token:{" "}
              <span className="font-mono">{lastImpersonation.impersonationToken}</span> (expires{" "}
              {new Date(lastImpersonation.expiresAt).toLocaleString()})
            </p>
          ) : null}
          {lastLoginLink ? (
            <p className="break-all rounded bg-slate-50 p-2 text-xs">
              Login link: <span className="font-mono">{lastLoginLink.url}</span> (expires{" "}
              {new Date(lastLoginLink.expiresAt).toLocaleString()})
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-amber-100 pt-4">
            <Button
              variant="outline"
              disabled={actionBusy !== null}
              onClick={() =>
                runAction("Unlock account", async () => {
                  await authedFetch(`/admin/support/users/${userId}/unlock`, { method: "POST" });
                })
              }
            >
              Unlock account
            </Button>
            <Button
              variant="outline"
              disabled={actionBusy !== null}
              onClick={() =>
                runAction("Reset password", async () => {
                  await authedFetch(`/admin/support/users/${userId}/reset-password`, {
                    method: "POST",
                  });
                })
              }
            >
              Reset password
            </Button>
            <Button
              variant="outline"
              disabled={actionBusy !== null}
              onClick={() =>
                runAction("Reset 2FA", async () => {
                  await authedFetch(`/admin/support/users/${userId}/reset-2fa`, { method: "POST" });
                })
              }
            >
              Reset 2FA
            </Button>
            <Button
              variant="outline"
              disabled={actionBusy !== null}
              onClick={() =>
                runAction("Invalidate sessions", async () => {
                  await authedFetch(`/admin/support/users/${userId}/invalidate-sessions`, {
                    method: "POST",
                  });
                })
              }
            >
              Invalidate sessions
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Financial Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          {customer.financialSyncStatus ? (
            <div className="text-sm">
              <p>Status: {customer.financialSyncStatus.status}</p>
              <p>
                Last synced:{" "}
                {customer.financialSyncStatus.lastSyncedAt
                  ? new Date(customer.financialSyncStatus.lastSyncedAt).toLocaleString()
                  : "never"}
              </p>
            </div>
          ) : (
            <p className="text-sm italic text-slate-400">Not tracked.</p>
          )}
        </CardContent>
      </Card>

      <SectionTable
        title="Subscriptions"
        rows={customer.subscriptions}
        columns={[
          { label: "ID", render: (s) => <span className="font-mono text-xs">{s.id}</span> },
          { label: "Status", render: (s) => s.status },
          { label: "Plan", render: (s) => s.planId },
        ]}
      />

      <SectionTable
        title="Licenses"
        rows={customer.licenses}
        columns={[
          { label: "ID", render: (l) => <span className="font-mono text-xs">{l.id}</span> },
          { label: "Type", render: (l) => l.type },
          { label: "Status", render: (l) => l.status },
        ]}
      />

      <SectionTable
        title="Devices"
        rows={customer.devices}
        columns={[
          { label: "Device", render: (d) => d.deviceId },
          { label: "Platform", render: (d) => d.platform },
          { label: "Status", render: (d) => d.status },
        ]}
      />

      <SectionTable
        title="Invoices"
        rows={customer.invoices}
        columns={[
          { label: "ID", render: (i) => <span className="font-mono text-xs">{i.id}</span> },
          { label: "Status", render: (i) => i.status },
          { label: "Amount due", render: (i) => `${i.amountDueMinor} ${i.currency}` },
        ]}
      />

      <SectionTable
        title="Receipts / Transactions"
        rows={customer.receipts}
        columns={[
          { label: "ID", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
          { label: "Status", render: (r) => r.status },
          { label: "Amount", render: (r) => `${r.amountMinor} ${r.currency}` },
        ]}
      />
    </main>
  );
}
