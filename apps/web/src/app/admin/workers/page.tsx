"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import { JOB_STATUSES, jobStatusVariant, type BackgroundJob } from "../../../lib/admin-jobs-types";

export default function AdminWorkersPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [queueName, setQueueName] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (queueName) params.set("queueName", queueName);
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }, [queueName, status, type]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<BackgroundJob[]>(`/admin/jobs${buildQuery()}`);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load jobs.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Workers</h1>
      <p className="mt-1 text-sm text-slate-500">Background jobs across every queue.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <div>
          <Label htmlFor="queueName">Queue name</Label>
          <Input
            id="queueName"
            value={queueName}
            onChange={(e) => setQueueName(e.target.value)}
            className="w-48"
            placeholder="e.g. notifications"
          />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-40"
          >
            <option value="">All statuses</option>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <Input
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-48"
            placeholder="e.g. SEND_NOTIFICATION"
          />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No jobs found.</p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Queue</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Cron</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <Link href={`/admin/workers/${job.id}`} className="font-medium underline">
                    {job.type}
                  </Link>
                </TableCell>
                <TableCell className="text-xs">{job.queueName}</TableCell>
                <TableCell className="text-xs">{job.priority}</TableCell>
                <TableCell>
                  <Badge variant={jobStatusVariant(job.status)}>{job.status}</Badge>
                </TableCell>
                <TableCell>
                  {job.attemptCount}/{job.maxAttempts}
                </TableCell>
                <TableCell className="font-mono text-xs">{job.cron ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {new Date(job.updatedAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
