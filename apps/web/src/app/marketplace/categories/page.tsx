"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLATFORM_NAME } from "@paywall/shared";
import { Alert, Card, CardContent } from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch, ApiError } from "../../../lib/api-client";
import type { StoreCategory } from "../../../lib/marketplace-store-types";

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

export default function MarketplaceCategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<StoreCategory[]>("/store/categories")
      .then(setCategories)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load categories."),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <MarketplaceHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
        <p className="mt-1 text-sm text-slate-500">Browse the marketplace by category.</p>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="mt-8 text-sm text-slate-500">No categories yet.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => router.push(`/marketplace?category=${c.slug}`)}
                className="text-left"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="pt-6">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    {c.description ? (
                      <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-400">{c._count.listings} applications</p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
