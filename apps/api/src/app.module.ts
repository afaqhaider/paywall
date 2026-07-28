import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { ApplicationsModule } from "./applications/applications.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { validateEnv } from "./config/env.validation";
import { HealthModule } from "./health/health.module";
import { MailModule } from "./mail/mail.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProfileModule } from "./profile/profile.module";
import { UsersModule } from "./users/users.module";
import { ProductsModule } from "./products/products.module";
import { FeaturesModule } from "./features/features.module";
import { CustomersModule } from "./customers/customers.module";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";
import { CouponsModule } from "./coupons/coupons.module";
import { TrialsModule } from "./trials/trials.module";
import { UsageModule } from "./usage/usage.module";
import { PaymentsModule } from "./payments/payments.module";
import { EntitlementsModule } from "./entitlements/entitlements.module";
import { LicensesModule } from "./licenses/licenses.module";
import { SeatsModule } from "./seats/seats.module";
import { UsageLimitsModule } from "./usage-limits/usage-limits.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { DevicesModule } from "./devices/devices.module";
import { DeveloperProfileModule } from "./developer-profile/developer-profile.module";
import { InvitationsModule } from "./invitations/invitations.module";
import { EnvironmentVariablesModule } from "./environment-variables/environment-variables.module";
import { AllowedOriginsModule } from "./allowed-origins/allowed-origins.module";
import { OAuthModule } from "./oauth/oauth.module";
import { DeveloperWebhooksModule } from "./webhooks/webhooks.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { SdkConfigModule } from "./sdk-config/sdk-config.module";
import { FinancialIntegrationModule } from "./financial-integration/financial-integration.module";
import { ErpConnectorModule } from "./erp-connector/erp-connector.module";
import { FinancialEventsModule } from "./financial-events/financial-events.module";
import { CustomerPortalModule } from "./customer-portal/customer-portal.module";
import { TwoFactorModule } from "./two-factor/two-factor.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PlatformAdminModule } from "./platform-admin/platform-admin.module";
import { AdminOrganizationsModule } from "./admin-organizations/admin-organizations.module";
import { AdminApplicationsModule } from "./admin-applications/admin-applications.module";
import { AdminCustomersModule } from "./admin-customers/admin-customers.module";
import { AdminSupportModule } from "./admin-support/admin-support.module";
import { AdminDirectoryModule } from "./admin-directory/admin-directory.module";
import { AdminAuditModule } from "./admin-audit/admin-audit.module";
import { AdminReportsModule } from "./admin-reports/admin-reports.module";
import { AdminSubscriptionsModule } from "./admin-subscriptions/admin-subscriptions.module";
import { AdminLicensesModule } from "./admin-licenses/admin-licenses.module";
import { AdminFinancialModule } from "./admin-financial/admin-financial.module";
import { AdminMonitoringModule } from "./admin-monitoring/admin-monitoring.module";
import { AdminFraudModule } from "./admin-fraud/admin-fraud.module";
import { AdminConfigModule } from "./admin-config/admin-config.module";
import { BackgroundJobsModule } from "./background-jobs/background-jobs.module";
import { PlatformEventsModule } from "./platform-events/platform-events.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import { AutomationModule } from "./automation/automation.module";
import { NotificationsEngineModule } from "./notifications-engine/notifications-engine.module";
import { SystemHealthModule } from "./system-health/system-health.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>("LOG_LEVEL", "info"),
          transport:
            config.get<string>("NODE_ENV") !== "production"
              ? { target: "pino-pretty", options: { singleLine: true } }
              : undefined,
          redact: ["req.headers.authorization", "req.headers.cookie"],
          autoLogging: true,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>("RATE_LIMIT_TTL_MS", 60_000),
            limit: config.get<number>("RATE_LIMIT_LIMIT", 100),
          },
        ],
      }),
    }),
    PrismaModule,
    MailModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    ProfileModule,
    OrganizationsModule,
    ApplicationsModule,
    ProductsModule,
    FeaturesModule,
    CustomersModule,
    CouponsModule,
    SubscriptionsModule,
    TrialsModule,
    UsageModule,
    PaymentsModule,
    EntitlementsModule,
    LicensesModule,
    SeatsModule,
    UsageLimitsModule,
    ApiKeysModule,
    DevicesModule,
    DeveloperProfileModule,
    InvitationsModule,
    EnvironmentVariablesModule,
    AllowedOriginsModule,
    OAuthModule,
    DeveloperWebhooksModule,
    AnalyticsModule,
    SdkConfigModule,
    FinancialIntegrationModule,
    ErpConnectorModule,
    FinancialEventsModule,
    CustomerPortalModule,
    TwoFactorModule,
    NotificationsModule,
    PlatformAdminModule,
    AdminOrganizationsModule,
    AdminApplicationsModule,
    AdminCustomersModule,
    AdminSupportModule,
    AdminDirectoryModule,
    AdminAuditModule,
    AdminReportsModule,
    AdminSubscriptionsModule,
    AdminLicensesModule,
    AdminFinancialModule,
    AdminMonitoringModule,
    AdminFraudModule,
    AdminConfigModule,
    BackgroundJobsModule,
    PlatformEventsModule,
    SchedulerModule,
    NotificationsEngineModule,
    AutomationModule,
    SystemHealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
