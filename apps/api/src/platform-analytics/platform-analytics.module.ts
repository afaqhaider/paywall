import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminDirectoryModule } from "../admin-directory/admin-directory.module";
import { HealthModule } from "../health/health.module";
import { PlatformAnalyticsAggregationService } from "./platform-analytics-aggregation.service";
import { DeveloperAnalyticsService } from "./developer-analytics.service";
import { ExecutiveDashboardService } from "./executive-dashboard.service";
import { PlatformAnalyticsController } from "./platform-analytics.controller";
import { DeveloperAnalyticsController } from "./developer-analytics.controller";

/**
 * Phase 11 "Marketplace, Analytics & Platform Intelligence" slice: platform-
 * wide advanced analytics, the executive dashboard (both platform-admin-
 * only, via `AdminDirectoryModule`'s exported `PlatformAdminGuard`), and
 * org-scoped developer analytics (via the shared `OrganizationRoleGuard`).
 * Purely additive - reads existing Subscription/PaymentTransaction/License/
 * AccessLog/WebhookDelivery/FinancialSync tables, never mutates them
 * (except for the opt-in `AnalyticsSnapshot` cache upsert).
 */
@Module({
  imports: [PrismaModule, AdminDirectoryModule, HealthModule],
  controllers: [PlatformAnalyticsController, DeveloperAnalyticsController],
  providers: [
    PlatformAnalyticsAggregationService,
    DeveloperAnalyticsService,
    ExecutiveDashboardService,
  ],
})
export class PlatformAnalyticsModule {}
