"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  Select,
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
import { useOrg } from "../../../../../lib/org-context";
import { ApiError, apiFetch } from "../../../../../lib/api-client";
import {
  LISTING_VISIBILITIES,
  MEDIA_ASSET_TYPES,
  type ListingVisibility,
  type MediaAssetType,
  type OwnedListing,
} from "../../../../../lib/listings-types";
import type { StoreCategory } from "../../../../../lib/marketplace-store-types";

function ListingManagementContent() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { authedFetch } = useAuth();
  const { selectedOrgId } = useOrg();

  const [listing, setListing] = useState<OwnedListing | null>(null);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Edit form
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<ListingVisibility>("PRIVATE");
  const [saving, setSaving] = useState(false);

  // Category picker
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [savingCategories, setSavingCategories] = useState(false);

  // Tag picker (no public tag-listing endpoint exists for developers - see
  // `MarketplaceTaxonomyController`, which is platform-admin-only - so tags
  // are attached by ID, obtained from a platform admin out of band).
  const [tagIdsInput, setTagIdsInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);

  // Media form
  const [mediaType, setMediaType] = useState<MediaAssetType>("SCREENSHOT");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [addingMedia, setAddingMedia] = useState(false);

  // Changelog form
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [addingChangelog, setAddingChangelog] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const basePath = `/organizations/${selectedOrgId}/applications/${applicationId}/listing`;

  const load = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch<OwnedListing>(basePath);
      setListing(data);
      setTagline(data.tagline ?? "");
      setDescription(data.description ?? "");
      setVisibility(data.visibility);
      setSelectedCategoryIds(data.categories.map((c) => c.categoryId));
      setTagIdsInput(data.tags.map((t) => t.tagId).join(", "));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this listing.");
    } finally {
      setLoading(false);
    }
  }, [authedFetch, basePath, selectedOrgId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    apiFetch<StoreCategory[]>("/store/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  async function handleSaveDetails(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await authedFetch<OwnedListing>(basePath, {
        method: "PUT",
        body: JSON.stringify({ tagline, description, visibility }),
      });
      setListing((prev) => (prev ? { ...prev, ...data } : prev));
      setMessage("Listing details saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save listing details.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLifecycle(action: "publish" | "unpublish" | "archive") {
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`${basePath}/${action}`, { method: "POST" });
      await load();
      setMessage(`Listing ${action}ed.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${action} the listing.`);
    }
  }

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleSaveCategories() {
    setSavingCategories(true);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`${basePath}/categories`, {
        method: "PUT",
        body: JSON.stringify({ categoryIds: selectedCategoryIds }),
      });
      await load();
      setMessage("Categories saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save categories.");
    } finally {
      setSavingCategories(false);
    }
  }

  async function handleSaveTags() {
    setSavingTags(true);
    setError(null);
    setMessage(null);
    try {
      const tagIds = tagIdsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await authedFetch(`${basePath}/tags`, {
        method: "PUT",
        body: JSON.stringify({ tagIds }),
      });
      await load();
      setMessage("Tags saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save tags.");
    } finally {
      setSavingTags(false);
    }
  }

  async function handleAddMedia(e: FormEvent) {
    e.preventDefault();
    setAddingMedia(true);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`${basePath}/media`, {
        method: "POST",
        body: JSON.stringify({
          type: mediaType,
          url: mediaUrl,
          caption: mediaCaption || undefined,
        }),
      });
      setMediaUrl("");
      setMediaCaption("");
      await load();
      setMessage("Media added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add media.");
    } finally {
      setAddingMedia(false);
    }
  }

  async function handleRemoveMedia(mediaId: string) {
    setError(null);
    try {
      await authedFetch(`${basePath}/media/${mediaId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove media.");
    }
  }

  async function handleAddChangelog(e: FormEvent) {
    e.preventDefault();
    setAddingChangelog(true);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`${basePath}/changelogs`, {
        method: "POST",
        body: JSON.stringify({ version, notes }),
      });
      setVersion("");
      setNotes("");
      await load();
      setMessage("Changelog entry added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add changelog entry.");
    } finally {
      setAddingChangelog(false);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setMessage(null);
    try {
      await authedFetch(`${basePath}/invites`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail }),
      });
      setInviteEmail("");
      await load();
      setMessage("Invite sent.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send invite.");
    } finally {
      setInviting(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setError(null);
    try {
      await authedFetch(`${basePath}/invites/${inviteId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not revoke invite.");
    }
  }

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <AppNav applicationId={applicationId} />
        <h1 className="text-2xl font-semibold text-slate-900">Marketplace Listing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage how this application appears in the public marketplace.
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

        {loading || !listing ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <Card className="mt-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Status</CardTitle>
                <Badge variant="outline">{listing.status}</Badge>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={listing.status === "PUBLISHED"}
                  onClick={() => void handleLifecycle("publish")}
                >
                  Publish
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={listing.status !== "PUBLISHED"}
                  onClick={() => void handleLifecycle("unpublish")}
                >
                  Unpublish
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={listing.status === "ARCHIVED"}
                  onClick={() => void handleLifecycle("archive")}
                >
                  Archive
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveDetails} className="flex flex-col gap-4" noValidate>
                  <div>
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input
                      id="tagline"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <div className="max-w-xs">
                    <Label htmlFor="visibility">Visibility</Label>
                    <Select
                      id="visibility"
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as ListingVisibility)}
                    >
                      {LISTING_VISIBILITIES.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button type="submit" disabled={saving} className="self-start">
                    {saving ? "Saving..." : "Save details"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <label key={c.id} className="flex items-center gap-1 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.includes(c.id)}
                        onChange={() => toggleCategory(c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={savingCategories}
                  onClick={() => void handleSaveCategories()}
                >
                  {savingCategories ? "Saving..." : "Save categories"}
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-xs text-slate-500">
                  Comma-separated tag IDs. Tag creation is a platform-admin action - ask an admin
                  for the IDs of the tags you want to attach.
                </p>
                <Input value={tagIdsInput} onChange={(e) => setTagIdsInput(e.target.value)} />
                <Button
                  size="sm"
                  className="mt-3"
                  disabled={savingTags}
                  onClick={() => void handleSaveTags()}
                >
                  {savingTags ? "Saving..." : "Save tags"}
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Media</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleAddMedia}
                  className="flex flex-wrap items-end gap-3"
                  noValidate
                >
                  <div>
                    <Label htmlFor="mediaType">Type</Label>
                    <Select
                      id="mediaType"
                      value={mediaType}
                      onChange={(e) => setMediaType(e.target.value as MediaAssetType)}
                      className="w-36"
                    >
                      {MEDIA_ASSET_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="mediaUrl">URL</Label>
                    <Input
                      id="mediaUrl"
                      required
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mediaCaption">Caption</Label>
                    <Input
                      id="mediaCaption"
                      value={mediaCaption}
                      onChange={(e) => setMediaCaption(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={addingMedia}>
                    {addingMedia ? "Adding..." : "Add"}
                  </Button>
                </form>
                <div className="mt-4 flex flex-col gap-2">
                  {listing.media.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span>
                        <Badge variant="outline" className="mr-2">
                          {m.type}
                        </Badge>
                        {m.url}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRemoveMedia(m.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Changelog</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleAddChangelog}
                  className="flex flex-wrap items-end gap-3"
                  noValidate
                >
                  <div className="w-40">
                    <Label htmlFor="version">Version</Label>
                    <Input
                      id="version"
                      required
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      required
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={addingChangelog}>
                    {addingChangelog ? "Adding..." : "Add entry"}
                  </Button>
                </form>
                <div className="mt-4 flex flex-col gap-2">
                  {listing.changelogs.map((c) => (
                    <div key={c.id} className="border-b border-slate-100 pb-2 text-sm">
                      <span className="font-medium">{c.version}</span> -{" "}
                      <span className="text-slate-600">{c.notes}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Invites</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-xs text-slate-500">
                  Only used when visibility is INVITE_ONLY - invited emails may view this listing.
                </p>
                <form onSubmit={handleInvite} className="flex items-end gap-3" noValidate>
                  <div className="flex-1">
                    <Label htmlFor="inviteEmail">Email</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? "Inviting..." : "Invite"}
                  </Button>
                </form>
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listing.invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(invite.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRevokeInvite(invite.id)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function ListingManagementPage() {
  return (
    <ProtectedRoute>
      <ListingManagementContent />
    </ProtectedRoute>
  );
}
