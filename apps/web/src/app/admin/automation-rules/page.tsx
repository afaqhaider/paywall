"use client";

import React, { useCallback, useEffect, useState, type FormEvent } from "react";
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
  Textarea,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { ApiError } from "../../../lib/api-client";
import { PLATFORM_EVENT_TYPES, type PlatformEventType } from "../../../lib/admin-events-types";
import {
  ruleExecutionStatusVariant,
  type AutomationRule,
  type AutomationRuleExecution,
} from "../../../lib/admin-automation-rules-types";

export default function AdminAutomationRulesPage() {
  const { authedFetch } = useAuth();
  const [items, setItems] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEventType, setTriggerEventType] = useState<PlatformEventType>(
    PLATFORM_EVENT_TYPES[0],
  );
  const [actionsText, setActionsText] = useState('[{ "action": "LOG_AUDIT" }]');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<Record<string, AutomationRuleExecution[]>>({});
  const [executionsLoading, setExecutionsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<AutomationRule[]>("/admin/automation-rules");
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load automation rules.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    let actions: Record<string, unknown>[];
    try {
      const parsed = JSON.parse(actionsText);
      if (!Array.isArray(parsed)) throw new Error("not an array");
      actions = parsed;
    } catch {
      setFormError('Actions must be valid JSON array, e.g. [{ "action": "LOG_AUDIT" }].');
      return;
    }

    setCreating(true);
    setMessage(null);
    setError(null);
    try {
      await authedFetch("/admin/automation-rules", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          triggerEventType,
          actions,
        }),
      });
      setMessage("Automation rule created.");
      setName("");
      setDescription("");
      setActionsText('[{ "action": "LOG_AUDIT" }]');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create automation rule.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(rule: AutomationRule) {
    setBusy(rule.id);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`/admin/automation-rules/${rule.id}/toggle`, {
        method: "POST",
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      setMessage(`Rule ${!rule.enabled ? "enabled" : "disabled"}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not toggle rule.");
    } finally {
      setBusy(null);
    }
  }

  async function handleExpand(ruleId: string) {
    if (expandedRuleId === ruleId) {
      setExpandedRuleId(null);
      return;
    }
    setExpandedRuleId(ruleId);
    if (!executions[ruleId]) {
      setExecutionsLoading(true);
      try {
        const data = await authedFetch<AutomationRuleExecution[]>(
          `/admin/automation-rules/${ruleId}/executions`,
        );
        setExecutions((prev) => ({ ...prev, [ruleId]: data }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load executions.");
      } finally {
        setExecutionsLoading(false);
      }
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">Automation rules</h1>
      <p className="mt-1 text-sm text-slate-500">
        Trigger background actions automatically when platform events occur.
      </p>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="success" className="mt-4">
          {message}
        </Alert>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Create a rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4" noValidate>
            {formError ? <Alert variant="destructive">{formError}</Alert> : null}
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="triggerEventType">Trigger event type</Label>
              <Select
                id="triggerEventType"
                value={triggerEventType}
                onChange={(e) =>
                  setTriggerEventType(e.target.value as (typeof PLATFORM_EVENT_TYPES)[number])
                }
              >
                {PLATFORM_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="actions">Actions (JSON array)</Label>
              <Textarea
                id="actions"
                value={actionsText}
                onChange={(e) => setActionsText(e.target.value)}
                rows={5}
                className="font-mono text-xs"
              />
              <p className="mt-1 text-xs text-slate-500">
                Free-form list of action objects, e.g.{" "}
                {'[{ "action": "SEND_NOTIFICATION", "category": "SUBSCRIPTION_RENEWED" }]'}
              </p>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create rule"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <p className="mt-8 text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No automation rules yet.</p>
      ) : (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Actions</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((rule) => (
              <React.Fragment key={rule.id}>
                <TableRow>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="text-xs">{rule.triggerEventType}</TableCell>
                  <TableCell>
                    <Badge variant={rule.enabled ? "success" : "outline"}>
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>{rule.actions?.length ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void handleToggle(rule)}
                      >
                        {busy === rule.id ? "Working..." : rule.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void handleExpand(rule.id)}>
                        {expandedRuleId === rule.id ? "Hide" : "Details"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {expandedRuleId === rule.id ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="rounded bg-slate-50 p-4 text-sm text-slate-700">
                        <p className="mb-2 text-slate-600">
                          {rule.description ?? "No description."}
                        </p>
                        <pre className="mb-4 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-xs">
                          {JSON.stringify(rule.actions, null, 2)}
                        </pre>
                        <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                          Recent executions
                        </h3>
                        {(() => {
                          const ruleExecutions = executions[rule.id];
                          if (executionsLoading) {
                            return <p className="text-xs text-slate-500">Loading executions…</p>;
                          }
                          if (!ruleExecutions || ruleExecutions.length === 0) {
                            return <p className="text-xs text-slate-500">No executions yet.</p>;
                          }
                          return (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Event</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Actions run</TableHead>
                                  <TableHead>Error</TableHead>
                                  <TableHead>Started</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {ruleExecutions.map((run) => (
                                  <TableRow key={run.id}>
                                    <TableCell className="font-mono text-xs">
                                      {run.eventId}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={ruleExecutionStatusVariant(run.status)}>
                                        {run.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{run.actionsRun}</TableCell>
                                    <TableCell className="text-xs">{run.error ?? "—"}</TableCell>
                                    <TableCell className="text-xs">
                                      {new Date(run.startedAt).toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          );
                        })()}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
