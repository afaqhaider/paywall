import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ReviewReportStatus } from "@prisma/client";
import { ReviewModerationService } from "./review-moderation.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/review-reports")
export class ReviewModerationController {
  constructor(private readonly moderationService: ReviewModerationService) {}

  @Get()
  async list(@Query("status") status?: ReviewReportStatus) {
    return this.moderationService.listReports(status);
  }

  @Patch(":reportId")
  async resolve(
    @Param("reportId") reportId: string,
    @Body("status") status: ReviewReportStatus,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.moderationService.resolve(reportId, status, user.id, extractRequestMeta(req));
  }
}
