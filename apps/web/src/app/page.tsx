"use client";

import { useEffect, useState } from "react";
import type { HealthStatus } from "@paywall/types";
import { PLATFORM_NAME } from "@paywall/shared";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@paywall/ui";

type FetchState =
  { kind: "loading" } | { kind: "error" } | { kind: "success"; health: HealthStatus };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LandingPage() {
  const [state, setState] = useState<FetchState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
        const health = (await res.json()) as HealthStatus;
        if (!cancelled) setState({ kind: "success", health });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    }

    void loadHealth();
    const interval = setInterval(loadHealth, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const apiOnline = state.kind === "success";
  const dbUp = state.kind === "success" && state.health.database === "up";
  const environment =
    state.kind === "success" ? state.health.environment : (process.env.NODE_ENV ?? "development");
  const version = state.kind === "success" ? state.health.version : "-";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">{PLATFORM_NAME}</h1>
        <p className="mt-2 text-sm uppercase tracking-widest text-slate-500">
          {environment} Environment
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>API Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={apiOnline ? "success" : "destructive"}>
              {state.kind === "loading" ? "Checking..." : apiOnline ? "Online" : "Offline"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Database Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={dbUp ? "success" : "destructive"}>
              {state.kind === "loading" ? "Checking..." : dbUp ? "Connected" : "Disconnected"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Version</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-lg font-semibold text-slate-900">{version}</span>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
