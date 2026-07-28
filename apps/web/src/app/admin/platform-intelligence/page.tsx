"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  Select,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import {
  ANALYTICS_METRICS,
  ANALYTICS_PERIODS,
  metricLabel,
  type AnalyticsMetric,
  type AnalyticsPeriod,
  type MetricComputation,
} from "../../../lib/platform-analytics-types";
import {
  PLATFORM_SEARCH_TYPES,
  type PlatformSearchResponse,
  type PlatformSearchType,
} from "../../../lib/admin-platform-search-types";

/** One tile per `AnalyticsMetric`, each an independent
 * `GET /admin/analytics/platform?metric=X&period=Y` call - same
 * one-card-per-item pattern as Phase 9's `admin/reports/page.tsx`. */
function MetricTile({ metric, period }: { metric: AnalyticsMetric; period: AnalyticsPeriod }) {
  const { authedFetch } = useAuth();
  const [result, setResult] = useState<MetricComputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<MetricComputation>(
        `/admin/analytics/platform?metric=${metric}&scope=PLATFORM&period=${period}`,
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this metric.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, metric, period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{metricLabel(metric)}</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : result ? (
          <>
            <p className="text-2xl font-semibold text-slate-900">{result.value}</p>
            {result.breakdown && result.breakdown.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {result.breakdown.map((b) => (
                  <Badge key={b.currency} variant="outline">
                    {b.currency}: {b.amountMinor}
                  </Badge>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-slate-500">No data.</p>
        )}
      </CardContent>
    </Card>
  );
}

function GlobalSearch() {
  const { authedFetch } = useAuth();
  const [q, setQ] = useState("");
  const [types, setTypes] = useState<PlatformSearchType[]>([...PLATFORM_SEARCH_TYPES]);
  const [response, setResponse] = useState<PlatformSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleType(t: PlatformSearchType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, types: types.join(",") });
      const data = await authedFetch<PlatformSearchResponse>(`/admin/search?${params.toString()}`);
      setResponse(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  const groups = response
    ? (Object.entries(response.results) as [
        string,
        PlatformSearchResponse["results"][keyof PlatformSearchResponse["results"]],
      ][])
    : [];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Global search</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3" noValidate>
          <div className="max-w-xs flex-1">
            <Label htmlFor="q">Query</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search everything..."
            />
          </div>
          <Button type="submit" disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </Button>
        </form>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
          {PLATFORM_SEARCH_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1">
              <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />
              {t}
            </label>
          ))}
        </div>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {response ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {groups
              .filter(([, rows]) => rows.length > 0)
              .map(([group, rows]) => (
                <div key={group}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {group}
                  </p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {rows.map((row) => (
                      <li key={`${row.type}-${row.id}`} className="text-sm text-slate-700">
                        {row.label}{" "}
                        <span className="font-mono text-xs text-slate-400">
                          ({row.id.slice(0, 8)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            {groups.every(([, rows]) => rows.length === 0) ? (
              <p className="text-sm text-slate-500">No results.</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function PlatformIntelligencePage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("MONTHLY");

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Platform Intelligence</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every advanced-analytics metric at a glance, plus platform-wide search.
          </p>
        </div>
        <Link
          href="/admin/report-requests"
          className="text-sm font-medium text-slate-900 underline"
        >
          Request a report
        </Link>
      </div>

      <div className="mt-4 max-w-xs">
        <Label htmlFor="period">Period</Label>
        <Select
          id="period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
        >
          {ANALYTICS_PERIODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ANALYTICS_METRICS.map((metric) => (
          <MetricTile key={metric} metric={metric} period={period} />
        ))}
      </div>

      <GlobalSearch />
    </main>
  );
}
