"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { PLATFORM_NAME } from "@paywall/shared";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  Textarea,
} from "@paywall/ui";
import { useAuth } from "../../../lib/auth-context";
import { apiFetch, ApiError } from "../../../lib/api-client";
import type { StoreListingDetail } from "../../../lib/marketplace-store-types";
import type { CreateReviewInput, Review } from "../../../lib/reviews-types";

function MarketplaceHeader() {
  const { status, user } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link href="/marketplace" className="text-base font-semibold tracking-tight text-slate-900">
          {PLATFORM_NAME}
          <span className="ml-2 font-normal text-slate-400">Marketplace</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link href="/marketplace" className="hover:text-slate-900">
            Browse
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

function WriteReviewForm({
  applicationSlugOrId,
  onSubmitted,
}: {
  applicationSlugOrId: string;
  onSubmitted: () => void;
}) {
  const { authedFetch } = useAuth();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const input: CreateReviewInput = {
        rating,
        title: title || undefined,
        body: body || undefined,
      };
      await authedFetch(`/store/apps/${applicationSlugOrId}/reviews`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      setTitle("");
      setBody("");
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <div className="max-w-[10rem]">
            <Label htmlFor="rating">Rating</Label>
            <Select id="rating" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r} star{r === 1 ? "" : "s"}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
            />
          </div>
          <div>
            <Label htmlFor="body">Review (optional)</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              rows={4}
            />
          </div>
          <Button type="submit" disabled={submitting} className="self-start">
            {submitting ? "Submitting..." : "Submit review"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function MarketplaceListingPage() {
  const { applicationSlugOrId } = useParams<{ applicationSlugOrId: string }>();
  const { status } = useAuth();

  const [listing, setListing] = useState<StoreListingDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listingData, reviewsData] = await Promise.all([
        apiFetch<StoreListingDetail>(`/store/apps/${applicationSlugOrId}`),
        apiFetch<Review[]>(`/store/apps/${applicationSlugOrId}/reviews`),
      ]);
      setListing(listingData);
      setReviews(reviewsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this application.");
    } finally {
      setLoading(false);
    }
  }, [applicationSlugOrId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <MarketplaceHeader />
      <main className="mx-auto max-w-4xl px-6 py-10">
        {error ? <Alert variant="destructive">{error}</Alert> : null}

        {loading || !listing ? (
          <p className="mt-8 text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <div className="flex items-center gap-4">
              {listing.application.iconUrl ? (
                <Image
                  src={listing.application.iconUrl}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-slate-100" />
              )}
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {listing.application.name}
                </h1>
                {listing.tagline ? (
                  <p className="text-sm text-slate-600">{listing.tagline}</p>
                ) : null}
                <p className="text-xs text-slate-400">
                  {listing.averageRating.toFixed(1)} ★ ({listing.reviewCount} reviews) ·{" "}
                  {listing.installCount} installs
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {listing.categories.map((c) => (
                <Badge key={c.category.id} variant="outline">
                  {c.category.name}
                </Badge>
              ))}
              {listing.tags.map((t) => (
                <Badge key={t.tag.id} variant="default">
                  {t.tag.name}
                </Badge>
              ))}
            </div>

            {listing.description ? (
              <p className="mt-6 whitespace-pre-wrap text-sm text-slate-700">
                {listing.description}
              </p>
            ) : null}

            {listing.media.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-slate-900">Media</h2>
                <div className="mt-2 flex gap-3 overflow-x-auto">
                  {listing.media.map((m) => (
                    <div key={m.id} className="shrink-0">
                      {m.type === "VIDEO" ? (
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm underline"
                        >
                          {m.caption ?? "Video"}
                        </a>
                      ) : (
                        <Image
                          src={m.url}
                          alt={m.caption ?? ""}
                          width={208}
                          height={128}
                          unoptimized
                          className="h-32 w-52 rounded-md object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {listing.changelogs.length > 0 ? (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-slate-900">Changelog</h2>
                <div className="mt-2 flex flex-col gap-3">
                  {listing.changelogs.map((c) => (
                    <div key={c.id} className="border-b border-slate-100 pb-2">
                      <p className="text-sm font-medium text-slate-900">
                        {c.version}{" "}
                        <span className="font-normal text-slate-400">
                          ({new Date(c.publishedAt).toLocaleDateString()})
                        </span>
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-slate-600">{c.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>
              {status === "authenticated" ? (
                <WriteReviewForm
                  applicationSlugOrId={applicationSlugOrId}
                  onSubmitted={() => void load()}
                />
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  <Link href="/login" className="underline">
                    Log in
                  </Link>{" "}
                  to write a review.
                </p>
              )}

              <div className="mt-4 flex flex-col gap-4">
                {reviews.length === 0 ? (
                  <p className="text-sm text-slate-500">No reviews yet.</p>
                ) : (
                  reviews.map((r) => (
                    <Card key={r.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-slate-900">
                            {r.customer.displayName ?? "Anonymous"}
                          </p>
                          <Badge variant="outline">{r.rating} ★</Badge>
                        </div>
                        {r.title ? (
                          <p className="mt-1 font-medium text-slate-800">{r.title}</p>
                        ) : null}
                        {r.body ? <p className="mt-1 text-sm text-slate-600">{r.body}</p> : null}
                        <p className="mt-2 text-xs text-slate-400">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </p>
                        {r.reply ? (
                          <div className="mt-2 rounded-md bg-slate-50 p-2 text-sm text-slate-700">
                            <p className="text-xs font-medium text-slate-500">Developer reply</p>
                            <p>{r.reply.body}</p>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
