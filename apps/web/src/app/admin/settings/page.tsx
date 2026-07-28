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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import {
  KNOWN_SETTING_KEYS,
  type FeatureFlag,
  type MessageTemplate,
  type PlatformSetting,
} from "../../../lib/admin-settings-types";
import type { PlatformAdmin } from "../../../lib/admin-platform-admins-types";

function SettingEditor({ settingKey }: { settingKey: string }) {
  const { authedFetch } = useAuth();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PlatformSetting>(`/admin/config/settings/${settingKey}`);
      setText(JSON.stringify(data.value ?? null, null, 2));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setText("null");
      } else {
        setError(err instanceof ApiError ? err.message : "Could not load setting.");
      }
    } finally {
      setLoading(false);
    }
  }, [authedFetch, settingKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      setError("Value must be valid JSON.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`/admin/config/settings/${settingKey}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-sm">{settingKey}</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-2">
            {error}
          </Alert>
        ) : null}
        {message ? (
          <Alert variant="success" className="mb-2">
            {message}
          </Alert>
        ) : null}
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="font-mono text-xs"
            />
            <Button className="mt-2" size="sm" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FeatureFlagsSection() {
  const { authedFetch } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<FeatureFlag[] | { items: FeatureFlag[] }>(
        `/admin/config/feature-flags`,
      );
      setFlags(Array.isArray(data) ? data : data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load feature flags.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle(flag: FeatureFlag) {
    setError(null);
    try {
      await authedFetch(`/admin/config/feature-flags/${flag.key}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !flag.enabled }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update feature flag.");
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newKey) return;
    setError(null);
    try {
      await authedFetch(`/admin/config/feature-flags`, {
        method: "POST",
        body: JSON.stringify({ key: newKey, enabled: false }),
      });
      setNewKey("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create feature flag.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Flags</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-2">
            {error}
          </Alert>
        ) : null}
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : flags.length === 0 ? (
          <p className="text-sm text-slate-500">No feature flags yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Rollout</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {flags.map((f) => (
                <TableRow key={f.key}>
                  <TableCell className="font-mono text-xs">{f.key}</TableCell>
                  <TableCell>
                    <Badge variant={f.enabled ? "success" : "outline"}>
                      {f.enabled ? "enabled" : "disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{f.rolloutPercentage ?? "—"}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => void handleToggle(f)}>
                      Toggle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <form onSubmit={handleCreate} className="mt-4 flex items-end gap-2">
          <div>
            <Label htmlFor="newFlagKey">New flag key</Label>
            <Input id="newFlagKey" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" disabled={!newKey}>
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MessageTemplateEditor() {
  const { authedFetch } = useAuth();
  const [type, setType] = useState("email");
  const [key, setKey] = useState("welcome");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleLoad() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await authedFetch<MessageTemplate>(
        `/admin/config/message-templates/${type}/${key}`,
      );
      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load template.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`/admin/config/message-templates/${type}/${key}`, {
        method: "PUT",
        body: JSON.stringify({ subject: subject || undefined, body }),
      });
      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Templates</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        {message ? <Alert variant="success">{message}</Alert> : null}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="tmplType">Type</Label>
            <Input
              id="tmplType"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <Label htmlFor="tmplKey">Key</Label>
            <Input
              id="tmplKey"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-40"
            />
          </div>
          <Button variant="outline" onClick={() => void handleLoad()} disabled={loading}>
            {loading ? "Loading..." : "Load"}
          </Button>
        </div>
        <div>
          <Label htmlFor="tmplSubject">Subject (optional)</Label>
          <Input id="tmplSubject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="tmplBody">Body</Label>
          <Textarea id="tmplBody" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <Button className="w-fit" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Saving..." : "Save template"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PlatformAdminsSection() {
  const { authedFetch } = useAuth();
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newUserId, setNewUserId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<PlatformAdmin[] | { items: PlatformAdmin[] }>(
        `/admin/platform-admins`,
      );
      setAdmins(Array.isArray(data) ? data : data.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load platform admins.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGrant(e: FormEvent) {
    e.preventDefault();
    if (!newUserId) return;
    setError(null);
    try {
      await authedFetch(`/admin/platform-admins`, {
        method: "POST",
        body: JSON.stringify({ userId: newUserId }),
      });
      setNewUserId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not grant admin access.");
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke platform admin access for this user?")) return;
    setError(null);
    try {
      await authedFetch(`/admin/platform-admins/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke admin access.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Admins</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive" className="mb-2">
            {error}
          </Alert>
        ) : null}
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : admins.length === 0 ? (
          <p className="text-sm text-slate-500">No platform admins listed.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.displayName ?? a.email}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(a.grantedAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => void handleRevoke(a.id)}>
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <form onSubmit={handleGrant} className="mt-4 flex items-end gap-2">
          <div>
            <Label htmlFor="newAdminUserId">Grant access to user ID</Label>
            <Input
              id="newAdminUserId"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              className="w-64"
            />
          </div>
          <Button type="submit" variant="outline" disabled={!newUserId}>
            Grant
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function AdminSettingsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Platform Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Core settings, feature flags, message templates and platform admin access.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Settings</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {KNOWN_SETTING_KEYS.map((key) => (
          <SettingEditor key={key} settingKey={key} />
        ))}
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Feature Flags</h2>
      <div className="mt-4">
        <FeatureFlagsSection />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Message Templates</h2>
      <div className="mt-4">
        <MessageTemplateEditor />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">Platform Admins</h2>
      <div className="mt-4">
        <PlatformAdminsSection />
      </div>
    </main>
  );
}
