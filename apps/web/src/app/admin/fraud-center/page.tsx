"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import {
  FRAUD_SIGNAL_TYPES,
  fraudSignalLabel,
  type AdminFraudSignal,
} from "../../../lib/admin-fraud-types";

function FraudSignalSection({ type }: { type: (typeof FRAUD_SIGNAL_TYPES)[number] }) {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<AdminFraudSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<AdminFraudSignal>>(`/admin/fraud/${type}`);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const first = items[0];
  const extraKeys =
    first !== undefined
      ? Object.keys(first).filter(
          (k) => !["id", "organizationId", "userId", "applicationId", "createdAt"].includes(k),
        )
      : [];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>
          {fraudSignalLabel(type)} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">No signals.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>User</TableHead>
                  {extraKeys.slice(0, 3).map((k) => (
                    <TableHead key={k}>{k}</TableHead>
                  ))}
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.organizationId ?? "—"}</TableCell>
                    <TableCell className="text-xs">{s.userId ?? "—"}</TableCell>
                    {extraKeys.slice(0, 3).map((k) => (
                      <TableCell key={k} className="text-xs">
                        {typeof s[k] === "object" ? JSON.stringify(s[k]) : String(s[k] ?? "—")}
                      </TableCell>
                    ))}
                    <TableCell className="text-xs">
                      {new Date(s.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminFraudCenterPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Fraud Center</h1>
      <p className="mt-1 text-sm text-slate-500">Platform-wide fraud and abuse signals.</p>

      {FRAUD_SIGNAL_TYPES.map((type) => (
        <FraudSignalSection key={type} type={type} />
      ))}
    </main>
  );
}
