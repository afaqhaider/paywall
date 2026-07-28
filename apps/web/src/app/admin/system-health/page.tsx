"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import {
  healthStatusVariant,
  type SystemHealthOverview,
} from "../../../lib/admin-system-health-types";

const POLL_INTERVAL_MS = 20_000;

function OverviewBanner({ overall }: { overall: SystemHealthOverview["overall"] }) {
  const styles: Record<SystemHealthOverview["overall"], string> = {
    HEALTHY: "bg-emerald-50 border-emerald-200 text-emerald-800",
    DEGRADED: "bg-amber-50 border-amber-200 text-amber-800",
    DOWN: "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${styles[overall]}`}>
      Overall platform status: {overall}
    </div>
  );
}

function ProviderCard({
  name,
  status,
  message,
  checkedAt,
  details,
}: {
  name: string;
  status: SystemHealthOverview["overall"];
  message?: string;
  checkedAt: string;
  details?: Record<string, unknown>;
}) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium capitalize">{name}</CardTitle>
        <Badge variant={healthStatusVariant(status)}>{status}</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">{message ?? "No message."}</p>
        <p className="mt-1 text-xs text-slate-400">
          Checked {new Date(checkedAt).toLocaleTimeString()}
        </p>
        {details ? (
          <button
            type="button"
            className="mt-2 text-xs text-slate-500 underline"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "Hide details" : "Show details"}
          </button>
        ) : null}
        {showDetails && details ? (
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-xs text-slate-700">
            {JSON.stringify(details, null, 2)}
          </pre>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AdminSystemHealthPage() {
  const { authedFetch } = useAuth();
  const [overview, setOverview] = useState<SystemHealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (isInitial: boolean) => {
      if (isInitial) setLoading(true);
      try {
        const data = await authedFetch<SystemHealthOverview>("/admin/system-health");
        setOverview(data);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load system health.");
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [authedFetch],
  );

  useEffect(() => {
    void load(true);
    intervalRef.current = setInterval(() => {
      void load(false);
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">System health</h1>
      <p className="mt-1 text-sm text-slate-500">
        Live provider health checks, refreshed automatically every {POLL_INTERVAL_MS / 1000}s.
      </p>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {loading || !overview ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <OverviewBanner overall={overview.overall} />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {overview.providers.map((provider) => (
              <ProviderCard
                key={provider.name}
                name={provider.name}
                status={provider.status}
                message={provider.message}
                checkedAt={provider.checkedAt}
                details={provider.details}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
