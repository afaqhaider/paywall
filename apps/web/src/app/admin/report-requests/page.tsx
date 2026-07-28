"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
import { ApiError, API_URL, getAccessToken } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import {
  REPORT_REQUEST_FORMATS,
  REPORT_REQUEST_TYPES,
  reportRequestStatusVariant,
  type ReportRequestFormat,
  type ReportRequestRecord,
  type ReportRequestType,
} from "../../../lib/admin-report-requests-types";

export default function AdminReportRequestsPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<ReportRequestRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<ReportRequestType>("REVENUE");
  const [format, setFormat] = useState<ReportRequestFormat>("CSV");
  const [organizationId, setOrganizationId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<ReportRequestRecord>>("/admin/report-requests");
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load report requests.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    try {
      const data = await authedFetch<CursorResult<ReportRequestRecord>>(
        `/admin/report-requests?cursor=${nextCursor}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more report requests.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authedFetch("/admin/report-requests", {
        method: "POST",
        body: JSON.stringify({
          type,
          format,
          organizationId: organizationId || undefined,
        }),
      });
      setOrganizationId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not request the report.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload(report: ReportRequestRecord) {
    try {
      const token = getAccessToken();
      const res = await fetch(`${API_URL}/admin/report-requests/${report.id}/download`, {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = report.filename ?? `report-${report.id}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download this report.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Report Requests</h1>
      <p className="mt-1 text-sm text-slate-500">
        Request asynchronous CSV/Excel/PDF/JSON exports and download completed reports.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="type">Type</Label>
          <Select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as ReportRequestType)}
            className="w-52"
          >
            {REPORT_REQUEST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="format">Format</Label>
          <Select
            id="format"
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportRequestFormat)}
            className="w-32"
          >
            {REPORT_REQUEST_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="organizationId">Organization ID (optional)</Label>
          <Input
            id="organizationId"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className="w-64"
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Requesting..." : "Request report"}
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
        <p className="mt-8 text-sm text-slate-500">No report requests yet.</p>
      ) : (
        <>
          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.type}</TableCell>
                  <TableCell>{r.format}</TableCell>
                  <TableCell>
                    <Badge variant={reportRequestStatusVariant(r.status)}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.organizationId ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(r.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    {r.status === "SUCCESS" ? (
                      <Button variant="outline" size="sm" onClick={() => void handleDownload(r)}>
                        Download
                      </Button>
                    ) : r.status === "FAILED" ? (
                      <span className="text-xs text-red-600">{r.error ?? "Failed"}</span>
                    ) : (
                      <span className="text-xs text-slate-400">Pending</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {nextCursor ? (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => void handleLoadMore()}>
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
