import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { ReplyToReviewDto } from "./dto/reply-to-review.dto";

@Injectable()
export class ReviewRepliesService {
  constructor(private readonly prisma: PrismaService) {}

  async reply(applicationId: string, reviewId: string, authorId: string, dto: ReplyToReviewDto) {
    const review = await this.requireReviewOnApplication(applicationId, reviewId);

    const existing = await this.prisma.reviewReply.findUnique({ where: { reviewId: review.id } });
    if (existing) {
      throw new ConflictException("This review already has a developer reply - update it instead");
    }

    return this.prisma.reviewReply.create({
      data: { reviewId: review.id, authorId, body: dto.body },
    });
  }

  async updateReply(applicationId: string, reviewId: string, dto: ReplyToReviewDto) {
    const review = await this.requireReviewOnApplication(applicationId, reviewId);
    const reply = await this.prisma.reviewReply.findUnique({ where: { reviewId: review.id } });
    if (!reply) {
      throw new NotFoundException("No reply exists yet for this review");
    }
    return this.prisma.reviewReply.update({ where: { id: reply.id }, data: { body: dto.body } });
  }

  async deleteReply(applicationId: string, reviewId: string) {
    const review = await this.requireReviewOnApplication(applicationId, reviewId);
    const reply = await this.prisma.reviewReply.findUnique({ where: { reviewId: review.id } });
    if (!reply) {
      throw new NotFoundException("No reply exists yet for this review");
    }
    await this.prisma.reviewReply.delete({ where: { id: reply.id } });
  }

  private async requireReviewOnApplication(applicationId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { listing: true },
    });
    if (!review || review.deletedAt || review.listing.applicationId !== applicationId) {
      throw new NotFoundException("Review not found on this application's listing");
    }
    return review;
  }
}
