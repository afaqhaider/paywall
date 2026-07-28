"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import { JOB_STATUSES, type QueueSummary } from "../../../lib/admin-jobs-types";

export default function AdminJobQueuesPage() {
  const { authedFetch } = useAuth();
  const [queues, setQueues] = useState<QueueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<QueueSummary[]>("/admin/jobs/queues");
      setQueues(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load queues.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePause(queueName: string, paused: boolean) {
    setBusy(queueName);
    setError(null);
    try {
      await authedFetch(`/admin/jobs/queues/${queueName}/${paused ? "resume" : "pause"}`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : `Could not ${paused ? "resume" : "pause"} queue.`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Queues</h1>
      <p className="mt-1 text-sm text-slate-500">
        Job queue status, per-status counts, and pause/resume controls.
      </p>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : queues.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No queues found.</p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Queue</TableHead>
              <TableHead>State</TableHead>
              {JOB_STATUSES.map((s) => (
                <TableHead key={s}>{s}</TableHead>
              ))}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queues.map((queue) => (
              <TableRow key={queue.queueName}>
                <TableCell className="font-medium">{queue.queueName}</TableCell>
                <TableCell>
                  <Badge variant={queue.paused ? "outline" : "success"}>
                    {queue.paused ? "Paused" : "Running"}
                  </Badge>
                </TableCell>
                {JOB_STATUSES.map((s) => (
                  <TableCell key={s}>{queue.counts[s] ?? 0}</TableCell>
                ))}
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => void togglePause(queue.queueName, queue.paused)}
                  >
                    {busy === queue.queueName ? "Working..." : queue.paused ? "Resume" : "Pause"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
