"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Card, CardContent, Input, Label, Select } from "@paywall/ui";
import { PLATFORM_NAME } from "@paywall/shared";
import { useAuth } from "../../lib/auth-context";
import { apiFetch, ApiError } from "../../lib/api-client";
import {
  STORE_SORT_VALUES,
  type StoreBrowseResult,
  type StoreCategory,
  type StoreListingCard,
  type StoreSort,
} from "../../lib/marketplace-store-types";

/**
 * Public marketplace storefront - `GET /store/apps` (`@Public()`, no auth).
 * Deliberately outside `admin/**`/`dashboard/**`: no `ProtectedRoute`, no
 * `AdminNav`/`DashboardNav`, just a lightweight header (mirrors how
 * `login/page.tsx` renders bare, without dashboard chrome).
 */
function MarketplaceHeader() {
  const { status, user } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/marketplace" className="text-base font-semibold tracking-tight text-slate-900">
          {PLATFORM_NAME}
          <span className="ml-2 font-normal text-slate-400">Marketplace</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link href="/marketplace" className="hover:text-slate-900">
            Browse
          </Link>
          <Link href="/marketplace/categories" className="hover:text-slate-900">
            Categories
          </Link>
          {status === "authenticated" ? (
            <>
              <span className="hidden text-slate-400 sm:inline">{user?.email}</span>
              <Link href="/dashboard" className="hover:text-slate-900">
                Dashboard
              </Link>
            </>
          ) : (
            <Link href="/login" className="hover:text-slate-900">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function AppCard({ listing }: { listing: StoreListingCard }) {
  return (
    <Link href={`/marketplace/${listing.application.slug || listing.applicationId}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col gap-2 pt-6">
          <div className="flex items-center gap-3">
            {listing.application.iconUrl ? (
              <Image
                src={listing.application.iconUrl}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 rounded-md object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-md bg-slate-100" />
            )}
            <div>
              <p className="font-medium text-slate-900">{listing.application.name}</p>
              {listing.averageRating !== undefined ? (
                <p className="text-xs text-slate-500">
                  {listing.averageRating.toFixed(1)} ★ ({listing.reviewCount ?? 0})
                </p>
              ) : null}
            </div>
          </div>
          {listing.tagline ? (
            <p className="line-clamp-2 text-sm text-slate-600">{listing.tagline}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap gap-1">
            {listing.categories.slice(0, 3).map((c) => (
              <Badge key={c.category.id} variant="outline">
                {c.category.name}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">{listing.installCount} installs</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [sort, setSort] = useState<StoreSort>(
    (searchParams.get("sort") as StoreSort) || "featured",
  );

  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [listings, setListings] = useState<StoreListingCard[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<StoreCategory[]>("/store/categories")
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (sort) params.set("sort", sort);
      if (cursor) params.set("cursor", cursor);
      const qs = params.toString();
      return qs ? `?${qs}` : "";
    },
    [q, category, sort],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StoreBrowseResult>(`/store/apps${buildQuery()}`);
      setListings(data.data);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the marketplace.");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<StoreBrowseResult>(`/store/apps${buildQuery(nextCursor)}`);
      setListings((prev) => [...prev, ...data.data]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load more apps.");
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (sort) params.set("sort", sort);
    router.replace(`/marketplace?${params.toString()}`);
    void load();
  }

  return (
    <>
      <MarketplaceHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Marketplace</h1>
        <p className="mt-1 text-sm text-slate-500">Browse applications published by developers.</p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="max-w-xs flex-1">
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search applications..."
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-48"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name} ({c._count.listings})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sort">Sort</Label>
            <Select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as StoreSort)}
              className="w-40"
            >
              {STORE_SORT_VALUES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline">
            Apply
          </Button>
        </form>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : listings.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No applications found.</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <AppCard key={listing.id} listing={listing} />
              ))}
            </div>
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
    </>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<p className="p-10 text-sm text-slate-500">Loading…</p>}>
      <MarketplaceContent />
    </Suspense>
  );
}
