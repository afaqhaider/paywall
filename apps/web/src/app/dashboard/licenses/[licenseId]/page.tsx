"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { CopyableSecret } from "../../../../components/copyable-secret";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import {
  licenseStatusVariant,
  type GeneratedLicenseKey,
  type License,
  type LicenseAssignment,
  type LicenseKey,
  type Seat,
  type SeatAssignment,
  type SeatSummary,
} from "../../../../lib/licenses-types";

function LicenseDetailContent() {
  const { licenseId } = useParams<{ licenseId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [seatLimit, setSeatLimit] = useState("");
  const [deviceLimit, setDeviceLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  // Assignments (INDIVIDUAL type)
  const [assignments, setAssignments] = useState<LicenseAssignment[]>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // License keys
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(true);
  const [activationLimit, setActivationLimit] = useState("1");
  const [keyExpiresAt, setKeyExpiresAt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<GeneratedLicenseKey | null>(null);
  const [transferTargets, setTransferTargets] = useState<Record<string, string>>({});

  // Seats (SEAT type)
  const [seatSummary, setSeatSummary] = useState<SeatSummary | null>(null);
  const [seatHistory, setSeatHistory] = useState<SeatAssignment[]>([]);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [bulkSeatCount, setBulkSeatCount] = useState("1");
  const [bulkCreating, setBulkCreating] = useState(false);
  const [seatAssignUserId, setSeatAssignUserId] = useState("");
  const [seatAssigning, setSeatAssigning] = useState(false);
  const [seatTransferTargets, setSeatTransferTargets] = useState<Record<string, string>>({});

  const loadLicense = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<License>(
        `/organizations/${selectedOrgId}/licenses/${licenseId}`,
      );
      setLicense(data);
      setSeatLimit(data.seatLimit != null ? String(data.seatLimit) : "");
      setDeviceLimit(data.deviceLimit != null ? String(data.deviceLimit) : "");
      setExpiresAt(data.expiresAt ? data.expiresAt.slice(0, 10) : "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load license.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, licenseId]);

  const loadAssignments = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const data = await authedFetch<LicenseAssignment[]>(
        `/organizations/${selectedOrgId}/licenses/${licenseId}/assignments`,
      );
      setAssignments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load license assignments.");
    }
  }, [authedFetch, selectedOrgId, licenseId]);

  const loadKeys = useCallback(async () => {
    if (!selectedOrgId) return;
    setKeysLoading(true);
    try {
      const data = await authedFetch<LicenseKey[]>(
        `/organizations/${selectedOrgId}/licenses/${licenseId}/keys`,
      );
      setKeys(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load license keys.");
    } finally {
      setKeysLoading(false);
    }
  }, [authedFetch, selectedOrgId, licenseId]);

  const loadSeats = useCallback(async () => {
    if (!selectedOrgId) return;
    setSeatsLoading(true);
    try {
      const [summary, history] = await Promise.all([
        authedFetch<SeatSummary>(
          `/organizations/${selectedOrgId}/licenses/${licenseId}/seats/summary`,
        ),
        authedFetch<SeatAssignment[]>(
          `/organizations/${selectedOrgId}/licenses/${licenseId}/seats/history`,
        ),
      ]);
      setSeatSummary(summary);
      setSeatHistory(history);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load seats.");
    } finally {
      setSeatsLoading(false);
    }
  }, [authedFetch, selectedOrgId, licenseId]);

  useEffect(() => {
    void loadLicense();
  }, [loadLicense]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  useEffect(() => {
    if (license?.type === "INDIVIDUAL") void loadAssignments();
  }, [license, loadAssignments]);

  useEffect(() => {
    if (license?.type === "SEAT") void loadSeats();
  }, [license, loadSeats]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setSaving(true);
    setActionMessage(null);
    try {
      const updated = await authedFetch<License>(
        `/organizations/${selectedOrgId}/licenses/${licenseId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            seatLimit: seatLimit ? Number(seatLimit) : undefined,
            deviceLimit: deviceLimit ? Number(deviceLimit) : undefined,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          }),
        },
      );
      setLicense(updated);
      setActionMessage("License updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update license.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    if (!selectedOrgId) return;
    setActionMessage(null);
    try {
      const updated = await authedFetch<License>(
        `/organizations/${selectedOrgId}/licenses/${licenseId}/revoke`,
        { method: "POST" },
      );
      setLicense(updated);
      setActionMessage("License revoked.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke license.");
    }
  }

  async function handleAssign(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId || !assignUserId) return;
    setAssigning(true);
    setActionMessage(null);
    try {
      await authedFetch(`/organizations/${selectedOrgId}/licenses/${licenseId}/assignments`, {
        method: "POST",
        body: JSON.stringify({ userId: assignUserId }),
      });
      setAssignUserId("");
      await loadAssignments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign license.");
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign(userId: string) {
    if (!selectedOrgId) return;
    setActionMessage(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/licenses/${licenseId}/assignments/${userId}`,
        { method: "DELETE" },
      );
      await loadAssignments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unassign license.");
    }
  }

  async function handleGenerateKey(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setGenerating(true);
    setError(null);
    setGeneratedKey(null);
    try {
      const key = await authedFetch<GeneratedLicenseKey>(
        `/organizations/${selectedOrgId}/licenses/${licenseId}/keys`,
        {
          method: "POST",
          body: JSON.stringify({
            activationLimit: activationLimit ? Number(activationLimit) : undefined,
            expiresAt: keyExpiresAt ? new Date(keyExpiresAt).toISOString() : undefined,
          }),
        },
      );
      setGeneratedKey(key);
      await loadKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate license key.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleActivateKey(licenseKeyId: string) {
    if (!selectedOrgId) return;
    setActionMessage(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/licenses/${licenseId}/keys/${licenseKeyId}/activate`,
        { method: "POST" },
      );
      setActionMessage("License key activated.");
      await loadKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not activate license key.");
    }
  }

  async function handleRevokeKey(licenseKeyId: string) {
    if (!selectedOrgId) return;
    setActionMessage(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/licenses/${licenseId}/keys/${licenseKeyId}/revoke`,
        { method: "POST" },
      );
      setActionMessage("License key revoked.");
      await loadKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke license key.");
    }
  }

  async function handleTransferKey(licenseKeyId: string) {
    if (!selectedOrgId) return;
    const targetLicenseId = transferTargets[licenseKeyId];
    if (!targetLicenseId) return;
    setActionMessage(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/licenses/${licenseId}/keys/${licenseKeyId}/transfer`,
        { method: "POST", body: JSON.stringify({ targetLicenseId }) },
      );
      setActionMessage("License key transferred.");
      await loadKeys();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not transfer license key.");
    }
  }

  async function handleBulkCreateSeats(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) return;
    setBulkCreating(true);
    setActionMessage(null);
    try {
      await authedFetch<Seat[]>(`/organizations/${selectedOrgId}/licenses/${licenseId}/seats`, {
        method: "POST",
        body: JSON.stringify({ count: Number(bulkSeatCount) || 1 }),
      });
      setActionMessage(`${bulkSeatCount} seat(s) created.`);
      await loadSeats();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create seats.");
    } finally {
      setBulkCreating(false);
    }
  }

  async function handleAssignSeat(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId || !seatAssignUserId) return;
    setSeatAssigning(true);
    setActionMessage(null);
    try {
      await authedFetch(`/organizations/${selectedOrgId}/licenses/${licenseId}/seats/assign`, {
        method: "POST",
        body: JSON.stringify({ userId: seatAssignUserId }),
      });
      setSeatAssignUserId("");
      await loadSeats();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not assign seat.");
    } finally {
      setSeatAssigning(false);
    }
  }

  async function handleRemoveSeatAssignment(seatAssignmentId: string) {
    if (!selectedOrgId) return;
    setActionMessage(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/licenses/${licenseId}/seats/assignments/${seatAssignmentId}/remove`,
        { method: "POST" },
      );
      await loadSeats();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove seat assignment.");
    }
  }

  async function handleTransferSeatAssignment(seatAssignmentId: string) {
    if (!selectedOrgId) return;
    const userId = seatTransferTargets[seatAssignmentId];
    if (!userId) return;
    setActionMessage(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/licenses/${licenseId}/seats/assignments/${seatAssignmentId}/transfer`,
        { method: "POST", body: JSON.stringify({ userId }) },
      );
      setActionMessage("Seat transferred.");
      await loadSeats();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not transfer seat.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/dashboard/licenses" className="text-sm text-slate-500 hover:text-slate-900">
          ← Licenses
        </Link>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        {loading || !license ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{license.type} license</h1>
                <p className="mt-1 font-mono text-xs text-slate-500">{license.id}</p>
              </div>
              <Badge variant={licenseStatusVariant(license.status)}>{license.status}</Badge>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="seatLimit">Seat limit</Label>
                      <Input
                        id="seatLimit"
                        type="number"
                        min={1}
                        value={seatLimit}
                        onChange={(e) => setSeatLimit(e.target.value)}
                        placeholder="Unlimited"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deviceLimit">Device limit</Label>
                      <Input
                        id="deviceLimit"
                        type="number"
                        min={1}
                        value={deviceLimit}
                        onChange={(e) => setDeviceLimit(e.target.value)}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="expiresAt">Expires at</Label>
                    <Input
                      id="expiresAt"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={saving || license.status === "REVOKED"}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                    {license.status !== "REVOKED" ? (
                      <Button type="button" variant="outline" onClick={() => void handleRevoke()}>
                        Revoke license
                      </Button>
                    ) : null}
                  </div>
                </form>
              </CardContent>
            </Card>

            {license.type === "INDIVIDUAL" ? (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Assignment</CardTitle>
                </CardHeader>
                <CardContent>
                  {assignments.length === 0 ? (
                    <p className="text-sm text-slate-500">Not assigned to anyone yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User ID</TableHead>
                          <TableHead>Assigned</TableHead>
                          <TableHead>Unassigned</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignments.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono text-xs">{a.userId}</TableCell>
                            <TableCell>{new Date(a.assignedAt).toLocaleString()}</TableCell>
                            <TableCell>
                              {a.unassignedAt ? new Date(a.unassignedAt).toLocaleString() : "—"}
                            </TableCell>
                            <TableCell>
                              {!a.unassignedAt ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void handleUnassign(a.userId)}
                                >
                                  Unassign
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  <form
                    onSubmit={handleAssign}
                    className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
                    noValidate
                  >
                    <div className="flex-1">
                      <Label htmlFor="assignUserId">User ID</Label>
                      <Input
                        id="assignUserId"
                        required
                        value={assignUserId}
                        onChange={(e) => setAssignUserId(e.target.value)}
                        placeholder="UUID of the user to assign"
                      />
                    </div>
                    <Button type="submit" disabled={assigning}>
                      {assigning ? "Assigning..." : "Assign license"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>License keys</CardTitle>
              </CardHeader>
              <CardContent>
                {generatedKey ? (
                  <Alert className="mb-4">
                    <p className="font-medium">
                      Key generated - copy it now, it will not be shown again.
                    </p>
                    <div className="mt-2">
                      <CopyableSecret value={generatedKey.key} />
                    </div>
                  </Alert>
                ) : null}

                {keysLoading ? (
                  <p className="text-sm text-slate-500">Loading…</p>
                ) : keys.length === 0 ? (
                  <p className="text-sm text-slate-500">No license keys generated yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Activations</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="font-mono text-xs">{key.displayCode}</TableCell>
                          <TableCell>
                            {key.activationCount} / {key.activationLimit}
                          </TableCell>
                          <TableCell>
                            <Badge variant={key.status === "ACTIVE" ? "success" : "outline"}>
                              {key.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={key.status !== "ACTIVE"}
                                onClick={() => void handleActivateKey(key.id)}
                              >
                                Activate
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={key.status !== "ACTIVE"}
                                onClick={() => void handleRevokeKey(key.id)}
                              >
                                Revoke
                              </Button>
                              <Input
                                className="h-8 w-36"
                                placeholder="Target license ID"
                                value={transferTargets[key.id] ?? ""}
                                onChange={(e) =>
                                  setTransferTargets((prev) => ({
                                    ...prev,
                                    [key.id]: e.target.value,
                                  }))
                                }
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!transferTargets[key.id]}
                                onClick={() => void handleTransferKey(key.id)}
                              >
                                Transfer
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <form
                  onSubmit={handleGenerateKey}
                  className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end"
                  noValidate
                >
                  <div>
                    <Label htmlFor="activationLimit">Activation limit</Label>
                    <Input
                      id="activationLimit"
                      type="number"
                      min={1}
                      value={activationLimit}
                      onChange={(e) => setActivationLimit(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="keyExpiresAt">Expires at</Label>
                    <Input
                      id="keyExpiresAt"
                      type="date"
                      value={keyExpiresAt}
                      onChange={(e) => setKeyExpiresAt(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={generating || license.status !== "ACTIVE"}>
                    {generating ? "Generating..." : "Generate key"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {license.type === "SEAT" ? (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Seats</CardTitle>
                </CardHeader>
                <CardContent>
                  {seatsLoading ? (
                    <p className="text-sm text-slate-500">Loading…</p>
                  ) : (
                    <>
                      {seatSummary ? (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                          <div className="rounded-md border border-slate-100 p-3 text-center">
                            <p className="text-lg font-semibold text-slate-900">
                              {seatSummary.total}
                            </p>
                            <p className="text-xs text-slate-500">Total</p>
                          </div>
                          <div className="rounded-md border border-slate-100 p-3 text-center">
                            <p className="text-lg font-semibold text-slate-900">
                              {seatSummary.available}
                            </p>
                            <p className="text-xs text-slate-500">Available</p>
                          </div>
                          <div className="rounded-md border border-slate-100 p-3 text-center">
                            <p className="text-lg font-semibold text-slate-900">
                              {seatSummary.assigned}
                            </p>
                            <p className="text-xs text-slate-500">Assigned</p>
                          </div>
                          <div className="rounded-md border border-slate-100 p-3 text-center">
                            <p className="text-lg font-semibold text-slate-900">
                              {seatSummary.pending}
                            </p>
                            <p className="text-xs text-slate-500">Pending</p>
                          </div>
                          <div className="rounded-md border border-slate-100 p-3 text-center">
                            <p className="text-lg font-semibold text-slate-900">
                              {seatSummary.inactive}
                            </p>
                            <p className="text-xs text-slate-500">Inactive</p>
                          </div>
                        </div>
                      ) : null}

                      <h3 className="mt-6 text-sm font-medium text-slate-700">
                        Assignment history
                      </h3>
                      {seatHistory.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">No seat assignments yet.</p>
                      ) : (
                        <Table className="mt-2">
                          <TableHeader>
                            <TableRow>
                              <TableHead>User ID</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Assigned</TableHead>
                              <TableHead>Unassigned</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {seatHistory.map((a) => (
                              <TableRow key={a.id}>
                                <TableCell className="font-mono text-xs">{a.userId}</TableCell>
                                <TableCell>
                                  <Badge variant={a.status === "ACTIVE" ? "success" : "outline"}>
                                    {a.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>{new Date(a.assignedAt).toLocaleString()}</TableCell>
                                <TableCell>
                                  {a.unassignedAt ? new Date(a.unassignedAt).toLocaleString() : "—"}
                                </TableCell>
                                <TableCell>
                                  {a.status === "ACTIVE" ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void handleRemoveSeatAssignment(a.id)}
                                      >
                                        Remove
                                      </Button>
                                      <Input
                                        className="h-8 w-32"
                                        placeholder="New user ID"
                                        value={seatTransferTargets[a.id] ?? ""}
                                        onChange={(e) =>
                                          setSeatTransferTargets((prev) => ({
                                            ...prev,
                                            [a.id]: e.target.value,
                                          }))
                                        }
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={!seatTransferTargets[a.id]}
                                        onClick={() => void handleTransferSeatAssignment(a.id)}
                                      >
                                        Transfer
                                      </Button>
                                    </div>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}

                      <div className="mt-6 grid grid-cols-1 gap-6 border-t border-slate-100 pt-4 sm:grid-cols-2">
                        <form
                          onSubmit={handleBulkCreateSeats}
                          className="flex flex-col gap-3"
                          noValidate
                        >
                          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Create seats
                          </h4>
                          <div className="flex items-end gap-3">
                            <div className="flex-1">
                              <Label htmlFor="bulkSeatCount">Count</Label>
                              <Input
                                id="bulkSeatCount"
                                type="number"
                                min={1}
                                max={10000}
                                value={bulkSeatCount}
                                onChange={(e) => setBulkSeatCount(e.target.value)}
                              />
                            </div>
                            <Button type="submit" disabled={bulkCreating}>
                              {bulkCreating ? "Creating..." : "Create"}
                            </Button>
                          </div>
                        </form>

                        <form
                          onSubmit={handleAssignSeat}
                          className="flex flex-col gap-3"
                          noValidate
                        >
                          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            Assign next available seat
                          </h4>
                          <div className="flex items-end gap-3">
                            <div className="flex-1">
                              <Label htmlFor="seatAssignUserId">User ID</Label>
                              <Input
                                id="seatAssignUserId"
                                required
                                value={seatAssignUserId}
                                onChange={(e) => setSeatAssignUserId(e.target.value)}
                                placeholder="UUID of the user"
                              />
                            </div>
                            <Button type="submit" disabled={seatAssigning}>
                              {seatAssigning ? "Assigning..." : "Assign"}
                            </Button>
                          </div>
                        </form>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}

export default function LicenseDetailPage() {
  return (
    <ProtectedRoute>
      <LicenseDetailContent />
    </ProtectedRoute>
  );
}
