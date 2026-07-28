"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Badge,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import type { CursorResult } from "../../../lib/cursor-types";
import {
  adminApplicationStatusVariant,
  type AdminApplicationListItem,
} from "../../../lib/admin-applications-types";

export default function AdminApplicationsPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<AdminApplicationListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (search) params.set("search", search);
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [search],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CursorResult<AdminApplicationListItem>>(
        `/admin/applications${buildQuery()}`,
      );
      setItems(data.items);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await authedFetch<CursorResult<AdminApplicationListItem>>(
        `/admin/applications${buildQuery(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more applications.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Applications</h1>
      <p className="mt-1 text-sm text-slate-500">All applications across every organization.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="mt-4 flex max-w-sm gap-2"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or slug…"
        />
        <Button type="submit" variant="outline">
          Search
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
        <p className="mt-8 text-sm text-slate-500">No applications found.</p>
      ) : (
        <>
          <Table className="mt-6">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <Link href={`/admin/applications/${app.id}`} className="font-medium underline">
                      {app.name}
                    </Link>
                    <p className="text-xs text-slate-400">/{app.slug}</p>
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/organizations/${app.organizationId}`} className="underline">
                      {app.organizationName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={adminApplicationStatusVariant(app.status)}>{app.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {nextCursor ? (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => void handleLoadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
