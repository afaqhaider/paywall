import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { DeveloperAnalyticsService } from "./developer-analytics.service";
import { DateRangeQueryDto } from "./dto/date-range-query.dto";

/**
 * The "Developer Analytics" bundle for one organization's own data
 * (revenue, customers, subscriptions, renewals, trials, refunds, API
 * requests, webhook deliveries, licenses, devices, usage trends) - every
 * query inside `DeveloperAnalyticsService` is filtered by this route's
 * `:organizationId`, never another organization's.
 */
@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/analytics")
export class DeveloperAnalyticsController {
  constructor(private readonly developerAnalyticsService: DeveloperAnalyticsService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async getBundle(
    @Param("organizationId") organizationId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.developerAnalyticsService.getBundle(organizationId, query);
  }
}
