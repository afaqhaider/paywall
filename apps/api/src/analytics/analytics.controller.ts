import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApplicationMemberRole } from "@prisma/client";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsRangeQueryDto } from "./dto/analytics-range-query.dto";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get("api-requests")
  async apiRequests(
    @Param("applicationId") applicationId: string,
    @Query() query: AnalyticsRangeQueryDto,
  ) {
    return this.analyticsService.apiRequests(applicationId, query.range);
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get("auth-requests")
  async authRequests(
    @Param("applicationId") applicationId: string,
    @Query() query: AnalyticsRangeQueryDto,
  ) {
    return this.analyticsService.authRequests(applicationId, query.range);
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get("webhook-stats")
  async webhookStats(@Param("applicationId") applicationId: string) {
    return this.analyticsService.webhookStats(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get("business-metrics")
  async businessMetrics(@Param("applicationId") applicationId: string) {
    return this.analyticsService.businessMetrics(applicationId);
  }
}
