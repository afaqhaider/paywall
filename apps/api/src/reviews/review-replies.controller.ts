import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApplicationMemberRole } from "@prisma/client";
import { ReviewRepliesService } from "./review-replies.service";
import { ReplyToReviewDto } from "./dto/reply-to-review.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller(
  "organizations/:organizationId/applications/:applicationId/listing/reviews/:reviewId/reply",
)
export class ReviewRepliesController {
  constructor(private readonly repliesService: ReviewRepliesService) {}

  @RequireAppRole(ApplicationMemberRole.SUPPORT)
  @Post()
  async reply(
    @Param("applicationId") applicationId: string,
    @Param("reviewId") reviewId: string,
    @Body() dto: ReplyToReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.repliesService.reply(applicationId, reviewId, user.id, dto);
  }

  @RequireAppRole(ApplicationMemberRole.SUPPORT)
  @Patch()
  async updateReply(
    @Param("applicationId") applicationId: string,
    @Param("reviewId") reviewId: string,
    @Body() dto: ReplyToReviewDto,
  ) {
    return this.repliesService.updateReply(applicationId, reviewId, dto);
  }

  @RequireAppRole(ApplicationMemberRole.SUPPORT)
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReply(
    @Param("applicationId") applicationId: string,
    @Param("reviewId") reviewId: string,
  ) {
    await this.repliesService.deleteReply(applicationId, reviewId);
  }
}
