/** Developer-side listing management types - mirrors `ListingsController`
 * (`organizations/:organizationId/applications/:applicationId/listing`).
 * Distinct from `marketplace-store-types.ts` (the public storefront read
 * model): this is the full owner-facing shape including `invites`. */

export const LISTING_VISIBILITIES = ["PUBLIC", "PRIVATE", "INVITE_ONLY", "INTERNAL"] as const;
export type ListingVisibility = (typeof LISTING_VISIBILITIES)[number];

export const LISTING_STATUSES = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const MEDIA_ASSET_TYPES = ["ICON", "SCREENSHOT", "VIDEO"] as const;
export type MediaAssetType = (typeof MEDIA_ASSET_TYPES)[number];

export interface MarketplaceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface MarketplaceTag {
  id: string;
  name: string;
  slug: string;
}

export interface ListingCategoryLink {
  id: string;
  categoryId: string;
  category: MarketplaceCategory;
}

export interface ListingTagLink {
  id: string;
  tagId: string;
  tag: MarketplaceTag;
}

export interface ListingMediaAsset {
  id: string;
  listingId: string;
  type: MediaAssetType;
  url: string;
  caption: string | null;
  position: number;
  createdAt: string;
}

export interface ListingChangelogEntry {
  id: string;
  listingId: string;
  version: string;
  notes: string;
  publishedAt: string;
}

export interface ListingInvite {
  id: string;
  listingId: string;
  email: string;
  invitedById: string;
  createdAt: string;
}

/** `GET /organizations/:organizationId/applications/:applicationId/listing` */
export interface OwnedListing {
  id: string;
  applicationId: string;
  tagline: string | null;
  description: string | null;
  status: ListingStatus;
  visibility: ListingVisibility;
  publishedAt: string | null;
  unpublishedAt: string | null;
  installCount: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  categories: ListingCategoryLink[];
  tags: ListingTagLink[];
  media: ListingMediaAsset[];
  changelogs: ListingChangelogEntry[];
  invites: ListingInvite[];
}

export interface UpsertListingInput {
  tagline?: string;
  description?: string;
  visibility?: ListingVisibility;
}

export interface AddMediaInput {
  type: MediaAssetType;
  url: string;
  caption?: string;
  position?: number;
}

export interface AddChangelogInput {
  version: string;
  notes: string;
}

export interface InviteToListingInput {
  email: string;
}
