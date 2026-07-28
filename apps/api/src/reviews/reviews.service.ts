import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ListingStatus, ListingVisibility } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { CreateReviewDto } from "./dto/create-review.dto";
import type { UpdateReviewDto } from "./dto/update-review.dto";
import type { ReportReviewDto } from "./dto/report-review.dto";
import type { RequestMeta } from "../common/utils/request-meta.util";

/**
 * A customer may review a listing only if they have (or had) a `Customer`
 * relationship scoped to that listing's `Application` - the same
 * authorization boundary the Customer Portal already uses (see
 * `me-customers.service.ts`), never a separate "verified purchase" concept
 * bolted on top.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listForListing(applicationSlugOrId: string) {
    const listing = await this.requirePublicListing(applicationSlugOrId);
    return this.prisma.review.findMany({
      where: { listingId: listing.id, deletedAt: null },
      include: { reply: true, customer: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(applicationSlugOrId: string, userId: string, dto: CreateReviewDto) {
    const listing = await this.requirePublicListing(applicationSlugOrId);
    const customer = await this.requireCustomer(userId, listing.applicationId);

    const existing = await this.prisma.review.findUnique({
      where: { listingId_customerId: { listingId: listing.id, customerId: customer.id } },
    });
    if (existing) {
      throw new ConflictException(
        "You have already reviewed this application - edit your existing review instead",
      );
    }

    return this.prisma.review.create({
      data: {
        listingId: listing.id,
        customerId: customer.id,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
      },
    });
  }

  async update(reviewId: string, userId: string, dto: UpdateReviewDto) {
    const review = await this.requireOwnReview(reviewId, userId);
    return this.prisma.review.update({
      where: { id: review.id },
      data: { rating: dto.rating, title: dto.title, body: dto.body, editedAt: new Date() },
    });
  }

  async delete(reviewId: string, userId: string) {
    const review = await this.requireOwnReview(reviewId, userId);
    await this.prisma.review.update({ where: { id: review.id }, data: { deletedAt: new Date() } });
  }

  async report(reviewId: string, userId: string, dto: ReportReviewDto, meta: RequestMeta) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.deletedAt) {
      throw new NotFoundException("Review not found");
    }

    const report = await this.prisma.reviewReport.create({
      data: { reviewId: review.id, reportedById: userId, reason: dto.reason },
    });

    await this.auditService.record({
      action: "REVIEW_REPORTED",
      userId,
      metadata: { reviewId: review.id, reportId: report.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return report;
  }

  private async requireCustomer(userId: string, applicationId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { userId, applicationId } });
    if (!customer) {
      throw new ForbiddenException("You must be a customer of this application to review it");
    }
    return customer;
  }

  private async requireOwnReview(reviewId: string, userId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { customer: { select: { userId: true } } },
    });
    if (!review || review.deletedAt) {
      throw new NotFoundException("Review not found");
    }
    if (review.customer.userId !== userId) {
      throw new ForbiddenException("You can only edit or delete your own review");
    }
    return review;
  }

  private async requirePublicListing(applicationSlugOrId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        status: ListingStatus.PUBLISHED,
        visibility: ListingVisibility.PUBLIC,
        application: { OR: [{ id: applicationSlugOrId }, { slug: applicationSlugOrId }] },
      },
    });
    if (!listing) {
      throw new NotFoundException("Listing not found or not publicly available");
    }
    return listing;
  }
}
