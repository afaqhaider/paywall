"use client";

import { useCallback, useEffect, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { useAuth } from "../../../../lib/auth-context";
import { ApiError } from "../../../../lib/api-client";
import { jobStatusVariant, type BackgroundJobDetail } from "../../../../lib/admin-jobs-types";

export default function AdminJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { authedFetch } = useAuth();
  const [job, setJob] = useState<BackgroundJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<BackgroundJobDetail>(`/admin/jobs/${jobId}`);
      setJob(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load job.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: string, path: string) {
    setBusy(action);
    setActionMessage(null);
    setError(null);
    try {
      await authedFetch(path, { method: "POST" });
      setActionMessage(`${action} succeeded.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${action.toLowerCase()}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin/workers" className="text-sm text-slate-500 hover:text-slate-900">
        ← Workers
      </Link>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}
      {actionMessage ? (
        <Alert variant="success" className="mt-4">
          {actionMessage}
        </Alert>
      ) : null}

      {loading || !job ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="mt-4 flex items-start justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">{job.type}</h1>
            <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <p>
                <span className="text-slate-500">ID:</span>{" "}
                <span className="font-mono text-xs">{job.id}</span>
              </p>
              <p>
                <span className="text-slate-500">Queue:</span> {job.queueName}
              </p>
              <p>
                <span className="text-slate-500">Priority:</span> {job.priority}
              </p>
              <p>
                <span className="text-slate-500">Attempts:</span> {job.attemptCount}/
                {job.maxAttempts}
              </p>
              <p>
                <span className="text-slate-500">Cron:</span>{" "}
                <span className="font-mono text-xs">{job.cron ?? "—"}</span>
              </p>
              <p>
                <span className="text-slate-500">Run at:</span>{" "}
                {job.runAt ? new Date(job.runAt).toLocaleString() : "—"}
              </p>
              <p>
                <span className="text-slate-500">Next attempt:</span>{" "}
                {job.nextAttemptAt ? new Date(job.nextAttemptAt).toLocaleString() : "—"}
              </p>
              <p>
                <span className="text-slate-500">Correlation ID:</span>{" "}
                <span className="font-mono text-xs">{job.correlationId ?? "—"}</span>
              </p>
              <p>
                <span className="text-slate-500">Source event:</span>{" "}
                {job.sourceEventId ? (
                  <Link href={`/admin/events/${job.sourceEventId}`} className="underline">
                    {job.sourceEventId}
                  </Link>
                ) : (
                  "—"
                )}
              </p>
              <p>
                <span className="text-slate-500">Completed:</span>{" "}
                {job.completedAt ? new Date(job.completedAt).toLocaleString() : "—"}
              </p>
              <p>
                <span className="text-slate-500">Cancelled:</span>{" "}
                {job.cancelledAt ? new Date(job.cancelledAt).toLocaleString() : "—"}
              </p>
              <p className="sm:col-span-2">
                <span className="text-slate-500">Error:</span> {job.error ?? "—"}
              </p>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() => void runAction("Retry", `/admin/jobs/${job.id}/retry`)}
              >
                {busy === "Retry" ? "Retrying..." : "Retry"}
              </Button>
              <Button
                variant="ghost"
                disabled={busy !== null}
                onClick={() => void runAction("Cancel", `/admin/jobs/${job.id}/cancel`)}
              >
                {busy === "Cancel" ? "Cancelling..." : "Cancel"}
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Payload</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs text-slate-700">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {!job.history || job.history.length === 0 ? (
                <p className="text-sm text-slate-500">No attempt history yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Occurred</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {job.history.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.attemptNumber}</TableCell>
                        <TableCell>
                          <Badge variant={jobStatusVariant(entry.status)}>{entry.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {entry.durationMs !== null ? `${entry.durationMs}ms` : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{entry.error ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(entry.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
