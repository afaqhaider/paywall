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
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
