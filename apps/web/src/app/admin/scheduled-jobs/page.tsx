"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import { jobStatusVariant, type BackgroundJob } from "../../../lib/admin-jobs-types";

export default function AdminScheduledJobsPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<BackgroundJob[]>("/admin/jobs");
      setItems(data.filter((job) => job.cron !== null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load scheduled jobs.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Scheduled jobs</h1>
      <p className="mt-1 text-sm text-slate-500">
        Recurring background jobs - derived from jobs with a non-null cron spec.
      </p>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No scheduled jobs found.</p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Schedule (cron)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Next run</TableHead>
              <TableHead>History</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.type}</TableCell>
                <TableCell className="font-mono text-xs">{job.cron}</TableCell>
                <TableCell>
                  <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {job.nextAttemptAt
                    ? new Date(job.nextAttemptAt).toLocaleString()
                    : job.runAt
                      ? new Date(job.runAt).toLocaleString()
                      : "—"}
                </TableCell>
                <TableCell>
                  <Link href={`/admin/workers/${job.id}`} className="underline">
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
