"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
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
import {
  REVIEW_REPORT_STATUSES,
  reviewReportStatusVariant,
  type ReviewReportRecord,
  type ReviewReportStatus,
} from "../../../lib/admin-review-reports-types";

export default function AdminReviewReportsPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<ReviewReportRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReviewReportStatus | "">("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : "";
      const data = await authedFetch<ReviewReportRecord[]>(`/admin/review-reports${qs}`);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load review reports.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleResolve(reportId: string, status: ReviewReportStatus) {
    setResolvingId(reportId);
    setError(null);
    try {
      await authedFetch(`/admin/review-reports/${reportId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resolve this report.");
    } finally {
      setResolvingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Review Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        Moderate reviews flagged by customers as inappropriate or abusive.
      </p>

      <div className="mt-4 max-w-xs">
        <Label htmlFor="status">Status</Label>
        <Select
          id="status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReviewReportStatus | "")}
        >
          <option value="">All statuses</option>
          {REVIEW_REPORT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No review reports found.</p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Application</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reported</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((report) => (
              <TableRow key={report.id}>
                <TableCell>{report.review.listing.application.name}</TableCell>
                <TableCell className="max-w-xs">
                  <p className="font-medium text-slate-900">
                    {report.review.rating} ★ {report.review.title ?? ""}
                  </p>
                  <p className="truncate text-xs text-slate-500">{report.review.body ?? "—"}</p>
                  {report.review.deletedAt ? (
                    <Badge variant="outline" className="mt-1">
                      Deleted
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-xs text-sm">{report.reason}</TableCell>
                <TableCell>
                  <Badge variant={reviewReportStatusVariant(report.status)}>{report.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {new Date(report.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  {report.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resolvingId === report.id}
                        onClick={() => void handleResolve(report.id, "REVIEWED")}
                      >
                        Mark reviewed
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={resolvingId === report.id}
                        onClick={() => void handleResolve(report.id, "DISMISSED")}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Resolved{" "}
                      {report.resolvedAt ? new Date(report.resolvedAt).toLocaleDateString() : ""}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
