"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Alert,
  Badge,
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
import { eventStatusVariant, type PlatformEventDetail } from "../../../../lib/admin-events-types";
import { jobStatusVariant } from "../../../../lib/admin-jobs-types";
import { ruleExecutionStatusVariant } from "../../../../lib/admin-automation-rules-types";

export default function AdminEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { authedFetch } = useAuth();
  const [event, setEvent] = useState<PlatformEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PlatformEventDetail>(`/admin/events/${eventId}`);
      setEvent(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load event.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin/events" className="text-sm text-slate-500 hover:text-slate-900">
        ← Events
      </Link>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {loading || !event ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="mt-4 flex items-start justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">{event.type}</h1>
            <Badge variant={eventStatusVariant(event.status)}>{event.status}</Badge>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <p>
                <span className="text-slate-500">ID:</span>{" "}
                <span className="font-mono text-xs">{event.id}</span>
              </p>
              <p>
                <span className="text-slate-500">Correlation ID:</span>{" "}
                <span className="font-mono text-xs">{event.correlationId ?? "—"}</span>
              </p>
              <p>
                <span className="text-slate-500">Organization:</span> {event.organizationId ?? "—"}
              </p>
              <p>
                <span className="text-slate-500">Application:</span> {event.applicationId ?? "—"}
              </p>
              <p>
                <span className="text-slate-500">Customer:</span> {event.customerId ?? "—"}
              </p>
              <p>
                <span className="text-slate-500">Created:</span>{" "}
                {new Date(event.createdAt).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Payload</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 text-xs text-slate-700">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Background jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {!event.jobs || event.jobs.length === 0 ? (
                <p className="text-sm text-slate-500">No background jobs triggered.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Queue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {event.jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <Link href={`/admin/workers/${job.id}`} className="underline">
                            {job.type}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">{job.queueName}</TableCell>
                        <TableCell>
                          <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {job.attemptCount}/{job.maxAttempts}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(job.createdAt).toLocaleString()}
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
              <CardTitle>Automation rule runs</CardTitle>
            </CardHeader>
            <CardContent>
              {!event.automationRuleRuns || event.automationRuleRuns.length === 0 ? (
                <p className="text-sm text-slate-500">No automation rules ran for this event.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions run</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {event.automationRuleRuns.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>{run.rule?.name ?? run.ruleId}</TableCell>
                        <TableCell>
                          <Badge variant={ruleExecutionStatusVariant(run.status)}>
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{run.actionsRun}</TableCell>
                        <TableCell className="text-xs">{run.error ?? "—"}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(run.startedAt).toLocaleString()}
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
