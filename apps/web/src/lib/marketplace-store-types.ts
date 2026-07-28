/** Public marketplace storefront types - mirrors `MarketplaceStoreController`
 * (`GET /store/**`, all `@Public()`, no auth required). */

export const STORE_SORT_VALUES = ["featured", "recent", "popular", "top_rated", "newest"] as const;
export type StoreSort = (typeof STORE_SORT_VALUES)[number];

export const STORE_SEARCH_BY_VALUES = [
  "application",
  "developer",
  "organization",
  "category",
  "feature",
  "tag",
] as const;
export type StoreSearchBy = (typeof STORE_SEARCH_BY_VALUES)[number];

export interface ListingApplicationSummary {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  organizationId: string;
}

export interface ListingCategorySummary {
  category: { id: string; name: string; slug: string; description: string | null };
}

export interface ListingTagSummary {
  tag: { id: string; name: string; slug: string };
}

/** Shape returned for each row of `GET /store/apps` and `GET /store/search`
 * - a `Listing` with `application`, `categories`, `tags` included (see
 * `LISTING_CARD_INCLUDE` in `marketplace-store.service.ts`). `sort=top_rated`
 * additionally carries `averageRating`/`reviewCount`. */
export interface StoreListingCard {
  id: string;
  applicationId: string;
  tagline: string | null;
  description: string | null;
  status: string;
  visibility: string;
  publishedAt: string | null;
  installCount: number;
  createdAt: string;
  updatedAt: string;
  application: ListingApplicationSummary;
  categories: ListingCategorySummary[];
  tags: ListingTagSummary[];
  averageRating?: number;
  reviewCount?: number;
}

export interface StoreBrowseResult {
  data: StoreListingCard[];
  nextCursor: string | null;
}

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  _count: { listings: number };
}

export interface StoreSearchResult {
  query: string;
  results: StoreListingCard[];
}

export interface ListingMedia {
  id: string;
  listingId: string;
  type: "ICON" | "SCREENSHOT" | "VIDEO";
  url: string;
  caption: string | null;
  position: number;
  createdAt: string;
}

export interface ListingChangelog {
  id: string;
  listingId: string;
  version: string;
  notes: string;
  publishedAt: string;
}

/** `GET /store/apps/:applicationSlugOrId` - full listing detail. */
export interface StoreListingDetail extends StoreListingCard {
  media: ListingMedia[];
  changelogs: ListingChangelog[];
  averageRating: number;
  reviewCount: number;
}
