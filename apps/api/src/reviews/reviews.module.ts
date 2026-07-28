import { Module } from "@nestjs/common";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";
import { ReviewRepliesController } from "./review-replies.controller";
import { ReviewRepliesService } from "./review-replies.service";
import { ReviewModerationController } from "./review-moderation.controller";
import { ReviewModerationService } from "./review-moderation.service";

@Module({
  controllers: [ReviewsController, ReviewRepliesController, ReviewModerationController],
  providers: [ReviewsService, ReviewRepliesService, ReviewModerationService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
