import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";
import { PlatformAnalyticsAggregationService } from "./platform-analytics-aggregation.service";
import { ExecutiveDashboardService } from "./executive-dashboard.service";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";
import { DateRangeQueryDto } from "./dto/date-range-query.dto";

/**
 * Platform-admin-only "Advanced Analytics" surface. `GET .../platform`
 * computes (and optionally caches) any single `AnalyticsMetric` at any
 * `AnalyticsScope`; `GET .../executive-dashboard` returns the fixed,
 * cross-organization executive bundle.
 */
@UseGuards(PlatformAdminGuard)
@Controller("admin/analytics")
export class PlatformAnalyticsController {
  constructor(
    private readonly aggregationService: PlatformAnalyticsAggregationService,
    private readonly executiveDashboardService: ExecutiveDashboardService,
  ) {}

  @Get("platform")
  async getPlatformMetric(@Query() query: AnalyticsQueryDto) {
    const result = await this.aggregationService.computeMetric(query);

    if (query.cache) {
      await this.aggregationService.computeAndCache(
        query.metric,
        result.scope,
        result.organizationId,
        result.applicationId,
        result.period,
        result.periodStart,
        result.periodEnd,
      );
    }

    return result;
  }

  @Get("executive-dashboard")
  async getExecutiveDashboard(@Query() query: DateRangeQueryDto) {
    return this.executiveDashboardService.getDashboard(query);
  }
}
