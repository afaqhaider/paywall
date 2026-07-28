import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ListingStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { UpsertListingDto } from "./dto/upsert-listing.dto";
import type { AddMediaDto } from "./dto/add-media.dto";
import type { AddChangelogDto } from "./dto/add-changelog.dto";
import type { InviteToListingDto } from "./dto/invite-to-listing.dto";

/**
 * Owns the marketplace-facing wrapper around an `Application` (`Listing`) -
 * never duplicates or mutates Application's own core fields (name, slug,
 * status, ApplicationVisibility). `ListingVisibility` is a distinct concept
 * scoped to "who can find this in the marketplace", not the App Registry's
 * dev-portal scoping.
 */
@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async getOrCreate(applicationId: string, userId: string) {
    const existing = await this.prisma.listing.findUnique({ where: { applicationId } });
    if (existing) {
      return existing;
    }
    return this.prisma.listing.create({ data: { applicationId, createdById: userId } });
  }

  async getForApplication(applicationId: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { applicationId },
      include: {
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        media: { orderBy: { position: "asc" } },
        changelogs: { orderBy: { publishedAt: "desc" } },
        invites: true,
      },
    });
    if (!listing) {
      throw new NotFoundException("This application has no marketplace listing yet");
    }
    return listing;
  }

  async upsert(applicationId: string, dto: UpsertListingDto, userId: string, meta: RequestMeta) {
    const listing = await this.getOrCreate(applicationId, userId);

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: {
        tagline: dto.tagline,
        description: dto.description,
        visibility: dto.visibility,
      },
    });

    await this.auditService.record({
      action: "LISTING_UPDATED",
      userId,
      applicationId,
      metadata: { listingId: updated.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async publish(applicationId: string, userId: string, meta: RequestMeta) {
    const listing = await this.requireListing(applicationId);

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: ListingStatus.PUBLISHED, publishedAt: new Date(), unpublishedAt: null },
    });

    await this.auditService.record({
      action: "LISTING_PUBLISHED",
      userId,
      applicationId,
      metadata: { listingId: updated.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async unpublish(applicationId: string, userId: string, meta: RequestMeta) {
    const listing = await this.requireListing(applicationId);

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: ListingStatus.UNPUBLISHED, unpublishedAt: new Date() },
    });

    await this.auditService.record({
      action: "LISTING_UNPUBLISHED",
      userId,
      applicationId,
      metadata: { listingId: updated.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async archive(applicationId: string, userId: string, meta: RequestMeta) {
    const listing = await this.requireListing(applicationId);

    const updated = await this.prisma.listing.update({
      where: { id: listing.id },
      data: { status: ListingStatus.ARCHIVED, unpublishedAt: new Date() },
    });

    await this.auditService.record({
      action: "LISTING_ARCHIVED",
      userId,
      applicationId,
      metadata: { listingId: updated.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }

  async setCategories(applicationId: string, categoryIds: string[]) {
    const listing = await this.requireListing(applicationId);

    await this.prisma.$transaction([
      this.prisma.listingCategory.deleteMany({ where: { listingId: listing.id } }),
      this.prisma.listingCategory.createMany({
        data: categoryIds.map((categoryId) => ({ listingId: listing.id, categoryId })),
        skipDuplicates: true,
      }),
    ]);

    return this.getForApplication(applicationId);
  }

  async setTags(applicationId: string, tagIds: string[]) {
    const listing = await this.requireListing(applicationId);

    await this.prisma.$transaction([
      this.prisma.listingTag.deleteMany({ where: { listingId: listing.id } }),
      this.prisma.listingTag.createMany({
        data: tagIds.map((tagId) => ({ listingId: listing.id, tagId })),
        skipDuplicates: true,
      }),
    ]);

    return this.getForApplication(applicationId);
  }

  async addMedia(applicationId: string, dto: AddMediaDto) {
    const listing = await this.requireListing(applicationId);
    return this.prisma.listingMedia.create({
      data: {
        listingId: listing.id,
        type: dto.type,
        url: dto.url,
        caption: dto.caption,
        position: dto.position ?? 0,
      },
    });
  }

  async removeMedia(applicationId: string, mediaId: string) {
    const listing = await this.requireListing(applicationId);
    const media = await this.prisma.listingMedia.findUnique({ where: { id: mediaId } });
    if (!media || media.listingId !== listing.id) {
      throw new NotFoundException("Media asset not found on this listing");
    }
    await this.prisma.listingMedia.delete({ where: { id: mediaId } });
  }

  async addChangelog(applicationId: string, dto: AddChangelogDto) {
    const listing = await this.requireListing(applicationId);
    return this.prisma.listingChangelog.create({
      data: { listingId: listing.id, version: dto.version, notes: dto.notes },
    });
  }

  async invite(applicationId: string, dto: InviteToListingDto, invitedById: string) {
    const listing = await this.requireListing(applicationId);

    const existing = await this.prisma.listingInvite.findUnique({
      where: { listingId_email: { listingId: listing.id, email: dto.email } },
    });
    if (existing) {
      throw new ConflictException("This email is already invited to the listing");
    }

    return this.prisma.listingInvite.create({
      data: { listingId: listing.id, email: dto.email, invitedById },
    });
  }

  async revokeInvite(applicationId: string, inviteId: string) {
    const listing = await this.requireListing(applicationId);
    const invite = await this.prisma.listingInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.listingId !== listing.id) {
      throw new NotFoundException("Invite not found on this listing");
    }
    await this.prisma.listingInvite.delete({ where: { id: inviteId } });
  }

  private async requireListing(applicationId: string) {
    const listing = await this.prisma.listing.findUnique({ where: { applicationId } });
    if (!listing) {
      throw new NotFoundException("This application has no marketplace listing yet");
    }
    return listing;
  }
}
