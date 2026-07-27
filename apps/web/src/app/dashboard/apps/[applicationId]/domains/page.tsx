"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../../components/protected-route";
import { DashboardNav } from "../../../../../components/dashboard-nav";
import { AppNav } from "../../../../../components/app-nav";
import { useAuth } from "../../../../../lib/auth-context";
import { ApiError } from "../../../../../lib/api-client";
import type { ApplicationDomain } from "../../../../../lib/applications-types";

function ApplicationDomainsContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();

  const [domains, setDomains] = useState<ApplicationDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [domain, setDomain] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<ApplicationDomain[]>(`/applications/${applicationId}/domains`);
      setDomains(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load domains.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setAdding(true);
    try {
      await authedFetch(`/applications/${applicationId}/domains`, {
        method: "POST",
        body: JSON.stringify({ domain, isPrimary }),
      });
      setDomain("");
      setIsPrimary(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add domain.");
    } finally {
      setAdding(false);
    }
  }

  async function handleVerify(domainId: string) {
    try {
      await authedFetch(`/applications/${applicationId}/domains/${domainId}/verify`, {
        method: "POST",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify domain.");
    }
  }

  async function handleRemove(domainId: string) {
    try {
      await authedFetch(`/applications/${applicationId}/domains/${domainId}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove domain.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <AppNav applicationId={applicationId} />
        <h1 className="text-2xl font-semibold text-slate-900">Domains</h1>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <Card className="mt-6">
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : domains.length === 0 ? (
              <p className="text-sm text-slate-500">No domains added yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>SSL</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        {d.domain}{" "}
                        {d.isPrimary ? (
                          <Badge variant="outline" className="ml-1">
                            primary
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.sslStatus === "ACTIVE" ? "success" : "outline"}>
                          {d.sslStatus.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={d.verificationStatus === "VERIFIED" ? "success" : "outline"}
                        >
                          {d.verificationStatus.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-2">
                        {d.verificationStatus !== "VERIFIED" ? (
                          <Button variant="ghost" size="sm" onClick={() => void handleVerify(d.id)}>
                            Verify
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => void handleRemove(d.id)}>
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <form
              onSubmit={handleAdd}
              className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
              noValidate
            >
              <div className="flex-1">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="erp.getledgix.com"
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Primary
              </label>
              <Button type="submit" disabled={adding}>
                {adding ? "Adding..." : "Add domain"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function ApplicationDomainsPage() {
  return (
    <ProtectedRoute>
      <ApplicationDomainsContent />
    </ProtectedRoute>
  );
}
