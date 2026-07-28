import { Injectable, NotFoundException } from "@nestjs/common";
import { ListingStatus, ListingVisibility, type Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { BrowseStoreQueryDto, SearchStoreQueryDto } from "./dto/browse-store-query.dto";

/** Only these are ever visible to the public store - PRIVATE/INVITE_ONLY/
 * INTERNAL listings never appear here, regardless of publish status. */
const PUBLIC_WHERE: Prisma.ListingWhereInput = {
  status: ListingStatus.PUBLISHED,
  visibility: ListingVisibility.PUBLIC,
};

const LISTING_CARD_INCLUDE = {
  application: {
    select: { id: true, name: true, slug: true, iconUrl: true, organizationId: true },
  },
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.ListingInclude;

@Injectable()
export class MarketplaceStoreService {
  constructor(private readonly prisma: PrismaService) {}

  async browse(query: BrowseStoreQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const where: Prisma.ListingWhereInput = {
      ...PUBLIC_WHERE,
      ...(cursorWhere ?? {}),
      ...(query.q
        ? {
            OR: [
              { tagline: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } },
              { application: { name: { contains: query.q, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(query.category ? { categories: { some: { category: { slug: query.category } } } } : {}),
      ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
    };

    const orderBy = this.resolveSort(query.sort);

    const rows = await this.prisma.listing.findMany({
      where,
      include: LISTING_CARD_INCLUDE,
      orderBy,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  /** "featured"/"popular"/"recent"/"top_rated"/"newest" all use a real,
   * inspectable order-by; there is no manual "featured" curation flag on
   * `Listing` (kept out to avoid a speculative schema addition) - featured
   * is a documented heuristic (installCount desc) rather than editorial
   * curation, until a real curation flow is requested. */
  private resolveSort(
    sort?: BrowseStoreQueryDto["sort"],
  ): Prisma.ListingOrderByWithRelationInput[] {
    switch (sort) {
      case "recent":
        return [{ publishedAt: "desc" }];
      case "popular":
      case "featured":
        return [{ installCount: "desc" }, { publishedAt: "desc" }];
      case "newest":
        return [{ createdAt: "desc" }];
      case "top_rated":
        // Rating is aggregated from `Review`, not a column on `Listing` -
        // handled separately via `topRated()` below rather than a plain
        // orderBy (Prisma can't order by a relation aggregate directly).
        return CURSOR_ORDER_BY;
      default:
        return CURSOR_ORDER_BY;
    }
  }

  async topRated(limit = 20) {
    const grouped = await this.prisma.review.groupBy({
      by: ["listingId"],
      where: { deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
      orderBy: { _avg: { rating: "desc" } },
      take: limit,
    });

    const listings = await this.prisma.listing.findMany({
      where: { id: { in: grouped.map((g) => g.listingId) }, ...PUBLIC_WHERE },
      include: LISTING_CARD_INCLUDE,
    });

    const byId = new Map(listings.map((l) => [l.id, l]));
    return grouped
      .map((g) => {
        const listing = byId.get(g.listingId);
        if (!listing) return null;
        return { ...listing, averageRating: g._avg.rating ?? 0, reviewCount: g._count._all };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }

  async listCategories() {
    return this.prisma.marketplaceCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { listings: true } } },
    });
  }

  async getListingDetail(applicationSlugOrId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        ...PUBLIC_WHERE,
        application: { OR: [{ id: applicationSlugOrId }, { slug: applicationSlugOrId }] },
      },
      include: {
        ...LISTING_CARD_INCLUDE,
        media: { orderBy: { position: "asc" } },
        changelogs: { orderBy: { publishedAt: "desc" } },
      },
    });
    if (!listing) {
      throw new NotFoundException("Listing not found or not publicly available");
    }

    const ratingAgg = await this.prisma.review.aggregate({
      where: { listingId: listing.id, deletedAt: null },
      _avg: { rating: true },
      _count: { _all: true },
    });

    return {
      ...listing,
      averageRating: ratingAgg._avg.rating ?? 0,
      reviewCount: ratingAgg._count._all,
    };
  }

  /** Discovery search across application / developer / organization /
   * category / feature / tags, scoped to publicly visible listings only. */
  async search(query: SearchStoreQueryDto) {
    const term = { contains: query.q, mode: "insensitive" as const };

    const listings = await this.prisma.listing.findMany({
      where: {
        ...PUBLIC_WHERE,
        OR: [
          { application: { name: term } },
          { application: { organization: { name: term } } },
          { categories: { some: { category: { name: term } } } },
          { tags: { some: { tag: { name: term } } } },
          { application: { features: { some: { name: term } } } },
        ],
      },
      include: LISTING_CARD_INCLUDE,
      take: 50,
    });

    return { query: query.q, results: listings };
  }
}
