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
  Textarea,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../../components/protected-route";
import { DashboardNav } from "../../../../../components/dashboard-nav";
import { AppNav } from "../../../../../components/app-nav";
import { useAuth } from "../../../../../lib/auth-context";
import { ApiError } from "../../../../../lib/api-client";
import type { ApplicationVersion } from "../../../../../lib/applications-types";

function ApplicationVersionsContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();

  const [versions, setVersions] = useState<ApplicationVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [track, setTrack] = useState("stable");
  const [androidVersion, setAndroidVersion] = useState("");
  const [iosVersion, setIosVersion] = useState("");
  const [webVersion, setWebVersion] = useState("");
  const [buildNumber, setBuildNumber] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<ApplicationVersion[]>(
        `/applications/${applicationId}/versions`,
      );
      setVersions(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load versions.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await authedFetch(`/applications/${applicationId}/versions`, {
        method: "POST",
        body: JSON.stringify({
          track,
          androidVersion: androidVersion || undefined,
          iosVersion: iosVersion || undefined,
          webVersion: webVersion || undefined,
          buildNumber: buildNumber || undefined,
          releaseNotes: releaseNotes || undefined,
        }),
      });
      setAndroidVersion("");
      setIosVersion("");
      setWebVersion("");
      setBuildNumber("");
      setReleaseNotes("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create version.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(versionId: string) {
    try {
      await authedFetch(`/applications/${applicationId}/versions/${versionId}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete version.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <AppNav applicationId={applicationId} />
        <h1 className="text-2xl font-semibold text-slate-900">Versions</h1>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <Card className="mt-6">
          <CardContent className="pt-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-slate-500">No versions released yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Track</TableHead>
                    <TableHead>Android</TableHead>
                    <TableHead>iOS</TableHead>
                    <TableHead>Web</TableHead>
                    <TableHead>Build</TableHead>
                    <TableHead>Released</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        {v.track}{" "}
                        {v.isLatest ? (
                          <Badge variant="success" className="ml-1">
                            latest
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{v.androidVersion ?? "—"}</TableCell>
                      <TableCell>{v.iosVersion ?? "—"}</TableCell>
                      <TableCell>{v.webVersion ?? "—"}</TableCell>
                      <TableCell>{v.buildNumber ?? "—"}</TableCell>
                      <TableCell>{new Date(v.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => void handleDelete(v.id)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <form
              onSubmit={handleCreate}
              className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
              noValidate
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <Label htmlFor="track">Track</Label>
                  <Input id="track" value={track} onChange={(e) => setTrack(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="android">Android</Label>
                  <Input
                    id="android"
                    value={androidVersion}
                    onChange={(e) => setAndroidVersion(e.target.value)}
                    placeholder="1.0.0"
                  />
                </div>
                <div>
                  <Label htmlFor="ios">iOS</Label>
                  <Input
                    id="ios"
                    value={iosVersion}
                    onChange={(e) => setIosVersion(e.target.value)}
                    placeholder="1.0.0"
                  />
                </div>
                <div>
                  <Label htmlFor="web">Web</Label>
                  <Input
                    id="web"
                    value={webVersion}
                    onChange={(e) => setWebVersion(e.target.value)}
                    placeholder="1.0.0"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="buildNumber">Build number</Label>
                <Input
                  id="buildNumber"
                  value={buildNumber}
                  onChange={(e) => setBuildNumber(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="releaseNotes">Release notes</Label>
                <Textarea
                  id="releaseNotes"
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Publishing..." : "Publish version"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function ApplicationVersionsPage() {
  return (
    <ProtectedRoute>
      <ApplicationVersionsContent />
    </ProtectedRoute>
  );
}
