"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ProtectedRoute } from "../../../components/protected-route";
import { PortalNav } from "../../../components/portal-nav";
import { CustomerSwitcher } from "../../../components/customer-switcher";
import { useAuth } from "../../../lib/auth-context";
import { useCustomer } from "../../../lib/customer-context";
import { ApiError } from "../../../lib/api-client";
import type { CustomerDeviceRegistration } from "../../../lib/customer-portal-types";

function deviceStatusVariant(
  status: CustomerDeviceRegistration["status"],
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "INACTIVE":
      return "outline";
    case "BLOCKED":
      return "destructive";
    default:
      return "default";
  }
}

function DevicesContent() {
  const { authedFetch } = useAuth();
  const { customers, selectedCustomerId, selectCustomer } = useCustomer();
  const [items, setItems] = useState<CustomerDeviceRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedCustomerId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<CustomerDeviceRegistration[]>(
        `/customer-portal/customers/${selectedCustomerId}/devices`,
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load devices.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, selectedCustomerId]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEditing(device: CustomerDeviceRegistration) {
    setEditingId(device.id);
    setEditingName(device.name ?? "");
  }

  async function saveRename(deviceId: string) {
    if (!selectedCustomerId) return;
    setBusyId(deviceId);
    setError(null);
    try {
      await authedFetch(`/customer-portal/customers/${selectedCustomerId}/devices/${deviceId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editingName || null }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename device.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeactivate(deviceId: string) {
    if (!selectedCustomerId) return;
    setBusyId(deviceId);
    setError(null);
    try {
      await authedFetch(
        `/customer-portal/customers/${selectedCustomerId}/devices/${deviceId}/deactivate`,
        { method: "POST" },
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not deactivate device.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(deviceId: string) {
    if (!selectedCustomerId) return;
    setBusyId(deviceId);
    setError(null);
    try {
      await authedFetch(`/customer-portal/customers/${selectedCustomerId}/devices/${deviceId}`, {
        method: "DELETE",
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove device.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PortalNav>
        <CustomerSwitcher
          customers={customers}
          selectedCustomerId={selectedCustomerId}
          onSelect={selectCustomer}
        />
      </PortalNav>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Devices</h1>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No devices registered on this account.</p>
        ) : (
          <Table className="mt-8">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>
                    {editingId === device.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-8 w-40"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          placeholder="Device name"
                        />
                        <Button
                          size="sm"
                          disabled={busyId === device.id}
                          onClick={() => void saveRename(device.id)}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-left font-medium text-slate-900 underline-offset-2 hover:underline"
                        onClick={() => startEditing(device)}
                      >
                        {device.name ?? device.deviceId}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>{device.platform}</TableCell>
                  <TableCell>
                    <Badge variant={deviceStatusVariant(device.status)}>{device.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(device.lastSeenAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === device.id || device.status !== "ACTIVE"}
                        onClick={() => void handleDeactivate(device.id)}
                      >
                        Deactivate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === device.id}
                        onClick={() => void handleRemove(device.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
