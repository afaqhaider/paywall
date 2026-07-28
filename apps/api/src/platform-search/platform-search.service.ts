import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const TAKE = 10;

/** Discriminator used in every result row so the client can route/render generically. */
type SearchResultType =
  | "organization"
  | "application"
  | "customer"
  | "subscription"
  | "invoice"
  | "license"
  | "apiKey"
  | "review";

export interface SearchResultRow {
  id: string;
  type: SearchResultType;
  label: string;
  organizationId: string | null;
}

export interface PlatformSearchResponse {
  query: string;
  results: {
    organizations: SearchResultRow[];
    applications: SearchResultRow[];
    customers: SearchResultRow[];
    subscriptions: SearchResultRow[];
    invoices: SearchResultRow[];
    licenses: SearchResultRow[];
    apiKeys: SearchResultRow[];
    reviews: SearchResultRow[];
  };
}

export const SEARCH_TYPES = [
  "organizations",
  "applications",
  "customers",
  "subscriptions",
  "invoices",
  "licenses",
  "apiKeys",
  "reviews",
] as const;

export type PlatformSearchType = (typeof SEARCH_TYPES)[number];

const UUID_PREFIX_RE = /^[0-9a-f-]{4,36}$/i;

/**
 * Cross-organization search for platform admins. Deliberately simple
 * `contains`/ILIKE-style filtering per entity, capped at a small `take`
 * per type so the aggregate payload stays bounded.
 *
 * LIMITATION / TODO: this does a handful of independent `contains` queries
 * per request rather than real full-text search. Postgres full-text search
 * (tsvector columns + GIN indexes) or trigram indexing (`pg_trgm`) would
 * meaningfully improve both relevance and query cost at scale - tracked as
 * a documented future improvement, not implemented here since it would
 * require schema changes (indexes/generated columns) outside this slice's
 * "no schema edits" constraint.
 */
@Injectable()
export class PlatformSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, types?: string[]): Promise<PlatformSearchResponse> {
    const trimmed = query?.trim() ?? "";
    const wanted = new Set<PlatformSearchType>(
      types && types.length > 0
        ? (types.filter((t): t is PlatformSearchType =>
            (SEARCH_TYPES as readonly string[]).includes(t),
          ) as PlatformSearchType[])
        : [...SEARCH_TYPES],
    );

    const empty: PlatformSearchResponse["results"] = {
      organizations: [],
      applications: [],
      customers: [],
      subscriptions: [],
      invoices: [],
      licenses: [],
      apiKeys: [],
      reviews: [],
    };

    if (!trimmed) {
      return { query: trimmed, results: empty };
    }

    const [
      organizations,
      applications,
      customers,
      subscriptions,
      invoices,
      licenses,
      apiKeys,
      reviews,
    ] = await Promise.all([
      wanted.has("organizations") ? this.searchOrganizations(trimmed) : Promise.resolve([]),
      wanted.has("applications") ? this.searchApplications(trimmed) : Promise.resolve([]),
      wanted.has("customers") ? this.searchCustomers(trimmed) : Promise.resolve([]),
      wanted.has("subscriptions") ? this.searchSubscriptions(trimmed) : Promise.resolve([]),
      wanted.has("invoices") ? this.searchInvoices(trimmed) : Promise.resolve([]),
      wanted.has("licenses") ? this.searchLicenses(trimmed) : Promise.resolve([]),
      wanted.has("apiKeys") ? this.searchApiKeys(trimmed) : Promise.resolve([]),
      wanted.has("reviews") ? this.searchReviews(trimmed) : Promise.resolve([]),
    ]);

    return {
      query: trimmed,
      results: {
        organizations,
        applications,
        customers,
        subscriptions,
        invoices,
        licenses,
        apiKeys,
        reviews,
      },
    };
  }

  private async searchOrganizations(query: string): Promise<SearchResultRow[]> {
    const rows = await this.prisma.organization.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      take: TAKE,
      select: { id: true, name: true },
    });
    return rows.map((r) => ({
      id: r.id,
      type: "organization" as const,
      label: r.name,
      organizationId: r.id,
    }));
  }

  private async searchApplications(query: string): Promise<SearchResultRow[]> {
    const rows = await this.prisma.application.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
      },
      take: TAKE,
      select: { id: true, name: true, displayName: true, organizationId: true },
    });
    return rows.map((r) => ({
      id: r.id,
      type: "application" as const,
      label: r.displayName ?? r.name,
      organizationId: r.organizationId,
    }));
  }

  private async searchCustomers(query: string): Promise<SearchResultRow[]> {
    const rows = await this.prisma.customer.findMany({
      where: {
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      take: TAKE,
      select: { id: true, displayName: true, email: true, organizationId: true },
    });
    return rows.map((r) => ({
      id: r.id,
      type: "customer" as const,
      label: r.displayName ?? r.email ?? r.id,
      organizationId: r.organizationId,
    }));
  }

  /**
   * Subscription has no free-text label of its own, so we keep this
   * deliberately simple: match on id prefix when the query looks like a
   * UUID fragment, otherwise search via the related customer's email/name.
   */
  private async searchSubscriptions(query: string): Promise<SearchResultRow[]> {
    if (UUID_PREFIX_RE.test(query)) {
      const rows = await this.prisma.subscription.findMany({
        where: { id: { contains: query, mode: "insensitive" } },
        take: TAKE,
        select: {
          id: true,
          organizationId: true,
          customer: { select: { displayName: true, email: true } },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        type: "subscription" as const,
        label: r.customer?.displayName ?? r.customer?.email ?? r.id,
        organizationId: r.organizationId,
      }));
    }

    const rows = await this.prisma.subscription.findMany({
      where: {
        customer: {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
      },
      take: TAKE,
      select: {
        id: true,
        organizationId: true,
        customer: { select: { displayName: true, email: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      type: "subscription" as const,
      label: r.customer?.displayName ?? r.customer?.email ?? r.id,
      organizationId: r.organizationId,
    }));
  }

  /**
   * PaymentInvoice has no invoice-number field - the closest analogue is
   * `providerInvoiceId` (the payment provider's own reference). We match on
   * that, falling back to an id-prefix match for UUID-shaped queries.
   */
  private async searchInvoices(query: string): Promise<SearchResultRow[]> {
    const rows = await this.prisma.paymentInvoice.findMany({
      where: {
        OR: [
          { providerInvoiceId: { contains: query, mode: "insensitive" } },
          ...(UUID_PREFIX_RE.test(query)
            ? [{ id: { contains: query, mode: "insensitive" as const } } as const]
            : []),
        ],
      },
      take: TAKE,
      select: { id: true, providerInvoiceId: true, customer: { select: { organizationId: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      type: "invoice" as const,
      label: r.providerInvoiceId ?? r.id,
      organizationId: r.customer?.organizationId ?? null,
    }));
  }

  /**
   * LicenseKey stores only a hash (`keyHash`) and a masked `displayCode`
   * (e.g. "SSZP-****-****-9F2A") - there is no recoverable plaintext key to
   * search. We match on `displayCode` and, for UUID-shaped queries, on id
   * prefix.
   */
  private async searchLicenses(query: string): Promise<SearchResultRow[]> {
    const rows = await this.prisma.licenseKey.findMany({
      where: {
        OR: [
          { displayCode: { contains: query, mode: "insensitive" } },
          ...(UUID_PREFIX_RE.test(query)
            ? [{ id: { contains: query, mode: "insensitive" as const } } as const]
            : []),
        ],
      },
      take: TAKE,
      select: { id: true, displayCode: true, license: { select: { organizationId: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      type: "license" as const,
      label: r.displayCode,
      organizationId: r.license?.organizationId ?? null,
    }));
  }

  /**
   * API credential secrets (`APIKey.keyHash`) are never searchable - only
   * the owning `APIClient.name` (a human label) is matched.
   */
  private async searchApiKeys(query: string): Promise<SearchResultRow[]> {
    const rows = await this.prisma.aPIClient.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      take: TAKE,
      select: { id: true, name: true, organizationId: true },
    });
    return rows.map((r) => ({
      id: r.id,
      type: "apiKey" as const,
      label: r.name,
      organizationId: r.organizationId,
    }));
  }

  private async searchReviews(query: string): Promise<SearchResultRow[]> {
    const rows = await this.prisma.review.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { body: { contains: query, mode: "insensitive" } },
        ],
      },
      take: TAKE,
      select: {
        id: true,
        title: true,
        listing: { select: { application: { select: { organizationId: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      type: "review" as const,
      label: r.title ?? r.id,
      organizationId: r.listing?.application?.organizationId ?? null,
    }));
  }
}
