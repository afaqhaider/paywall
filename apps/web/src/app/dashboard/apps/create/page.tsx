"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardContent, Input, Label, Select, Textarea } from "@paywall/ui";
import { ProtectedRoute } from "../../../../components/protected-route";
import { DashboardNav } from "../../../../components/dashboard-nav";
import { useAuth } from "../../../../lib/auth-context";
import { useOrg } from "../../../../lib/org-context";
import { ApiError } from "../../../../lib/api-client";
import type { Application, ApplicationVisibility } from "../../../../lib/applications-types";

function CreateApplicationContent() {
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();
  const router = useRouter();

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState<ApplicationVisibility>("PRIVATE");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrgId) {
      setError("Select an organization first.");
      return;
    }

    setError(null);
    setCreating(true);
    try {
      const app = await authedFetch<Application>(`/organizations/${selectedOrgId}/applications`, {
        method: "POST",
        body: JSON.stringify({
          name,
          displayName: displayName || undefined,
          description: description || undefined,
          category: category || undefined,
          visibility,
        }),
      });
      router.push(`/dashboard/apps/${app.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create application.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Create application</h1>
        <p className="mt-1 text-sm text-slate-500">
          Register a new application in the SSCodeAxis ecosystem.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              {error ? <Alert variant="destructive">{error}</Alert> : null}

              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  required
                  minLength={2}
                  maxLength={150}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="LedGix ERP"
                />
              </div>

              <div>
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  maxLength={150}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Optional - defaults to name"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  maxLength={100}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="ERP, Productivity, IoT..."
                />
              </div>

              <div>
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as ApplicationVisibility)}
                >
                  <option value="PRIVATE">Private - only application members</option>
                  <option value="INTERNAL">Internal - visible to all organization members</option>
                </Select>
              </div>

              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

export default function CreateApplicationPage() {
  return (
    <ProtectedRoute>
      <CreateApplicationContent />
    </ProtectedRoute>
  );
}
