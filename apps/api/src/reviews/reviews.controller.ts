import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { UpdateReviewDto } from "./dto/update-review.dto";
import { ReportReviewDto } from "./dto/report-review.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

/**
 * Reviews are read publicly (part of the storefront) but writing one
 * requires an authenticated `User` who has a `Customer` relationship with
 * the listing's application - see `ReviewsService.requireCustomer`. Only
 * the read endpoint is `@Public()`; write endpoints rely on the global JWT
 * guard.
 */
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Public()
  @Get("store/apps/:applicationSlugOrId/reviews")
  async list(@Param("applicationSlugOrId") applicationSlugOrId: string) {
    return this.reviewsService.listForListing(applicationSlugOrId);
  }

  @Post("store/apps/:applicationSlugOrId/reviews")
  async create(
    @Param("applicationSlugOrId") applicationSlugOrId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.create(applicationSlugOrId, user.id, dto);
  }

  @Patch("reviews/:reviewId")
  async update(
    @Param("reviewId") reviewId: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewsService.update(reviewId, user.id, dto);
  }

  @Delete("reviews/:reviewId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param("reviewId") reviewId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.reviewsService.delete(reviewId, user.id);
  }

  @Post("reviews/:reviewId/report")
  async report(
    @Param("reviewId") reviewId: string,
    @Body() dto: ReportReviewDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.reviewsService.report(reviewId, user.id, dto, extractRequestMeta(req));
  }
}
