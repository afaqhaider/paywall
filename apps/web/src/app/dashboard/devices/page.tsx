"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paywall/ui";
import { ProtectedRoute } from "../../../components/protected-route";
import { DashboardNav } from "../../../components/dashboard-nav";
import { OrgSwitcher } from "../../../components/org-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useOrg } from "../../../lib/org-context";
import { ApiError } from "../../../lib/api-client";
import type { ApplicationListResult } from "../../../lib/applications-types";
import {
  DEVICE_PLATFORMS,
  type DevicePlatform,
  type DeviceRegistration,
} from "../../../lib/devices-types";

function DevicesContent() {
  const { authedFetch } = useAuth();
  const { organizations, selectedOrgId, selectedOrg, selectOrg } = useOrg();

  const [applications, setApplications] = useState<ApplicationListResult | null>(null);
  const [applicationId, setApplicationId] = useState("");

  const [devices, setDevices] = useState<DeviceRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [deviceId, setDeviceId] = useState("");
  const [platform, setPlatform] = useState<DevicePlatform>("IOS");
  const [userId, setUserId] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [registering, setRegistering] = useState(false);

  const loadApplications = useCallback(async () => {
    if (!selectedOrgId) {
      setApplications(null);
      setApplicationId("");
      return;
    }
    try {
      const data = await authedFetch<ApplicationListResult>(
        `/organizations/${selectedOrgId}/applications`,
      );
      setApplications(data);
      setApplicationId((current) =>
        current && data.items.some((a) => a.id === current) ? current : (data.items[0]?.id ?? ""),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load applications.");
    }
  }, [authedFetch, selectedOrgId]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const loadDevices = useCallback(async () => {
    if (!selectedOrgId || !applicationId) {
      setDevices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<DeviceRegistration[]>(
        `/organizations/${selectedOrgId}/applications/${applicationId}/devices`,
      );
      setDevices(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load devices.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedOrgId, applicationId]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  async function handleRegister(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId || !applicationId) return;
    setRegistering(true);
    setActionMessage(null);
    try {
      await authedFetch(`/organizations/${selectedOrgId}/applications/${applicationId}/devices`, {
        method: "POST",
        body: JSON.stringify({
          deviceId,
          platform,
          userId: userId || undefined,
          appVersion: appVersion || undefined,
        }),
      });
      setDeviceId("");
      setUserId("");
      setAppVersion("");
      setActionMessage("Device registered.");
      await loadDevices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register device.");
    } finally {
      setRegistering(false);
    }
  }

  async function handleRevoke(deviceRegistrationId: string) {
    if (!selectedOrgId || !applicationId) return;
    setActionMessage(null);
    try {
      await authedFetch(
        `/organizations/${selectedOrgId}/applications/${applicationId}/devices/${deviceRegistrationId}/revoke`,
        { method: "POST" },
      );
      setActionMessage("Device revoked.");
      await loadDevices();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke device.");
    }
  }

  return (
    <>
      <DashboardNav>
        <OrgSwitcher
          organizations={organizations}
          selectedOrgId={selectedOrgId}
          onSelect={selectOrg}
        />
      </DashboardNav>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Devices</h1>
        <p className="mt-1 text-sm text-slate-500">
          Registered devices for{" "}
          <span className="font-medium">{selectedOrg?.name ?? "your organization"}</span>.
        </p>

        <div className="mt-4 max-w-xs">
          <Label htmlFor="applicationFilter">Application</Label>
          {applications && applications.items.length > 0 ? (
            <Select
              id="applicationFilter"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
            >
              {applications.items.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.displayName ?? app.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-sm text-slate-500">No applications yet.</p>
          )}
        </div>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}
        {actionMessage ? <Alert className="mt-4">{actionMessage}</Alert> : null}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Registered devices</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : devices.length === 0 ? (
              <p className="text-sm text-slate-500">
                No devices registered yet for this application.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>App version</TableHead>
                    <TableHead>Last seen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.id}>
                      <TableCell className="font-mono text-xs">{device.deviceId}</TableCell>
                      <TableCell>{device.platform}</TableCell>
                      <TableCell>{device.appVersion ?? "—"}</TableCell>
                      <TableCell>{new Date(device.lastSeenAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={device.status === "ACTIVE" ? "success" : "outline"}>
                          {device.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {device.status !== "BLOCKED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRevoke(device.id)}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <form
              onSubmit={handleRegister}
              className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4"
              noValidate
            >
              <h3 className="text-sm font-medium text-slate-700">Register a device</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <Label htmlFor="deviceId">Device ID</Label>
                  <Input
                    id="deviceId"
                    required
                    maxLength={300}
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="client-generated ID"
                  />
                </div>
                <div>
                  <Label htmlFor="platform">Platform</Label>
                  <Select
                    id="platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as DevicePlatform)}
                  >
                    {DEVICE_PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="userId">User ID</Label>
                  <Input
                    id="userId"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="appVersion">App version</Label>
                  <Input
                    id="appVersion"
                    value={appVersion}
                    onChange={(e) => setAppVersion(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <Button type="submit" disabled={registering || !deviceId}>
                {registering ? "Registering..." : "Register device"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function DevicesPage() {
  return (
    <ProtectedRoute>
      <DevicesContent />
    </ProtectedRoute>
  );
}
