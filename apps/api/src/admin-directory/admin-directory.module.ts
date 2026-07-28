import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AdminDirectoryService } from "./admin-directory.service";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { AdminSubscriptionsController } from "./admin-subscriptions.controller";
import { AdminLicensesController } from "./admin-licenses.controller";
import { AdminFinancialIntegrationsController } from "./admin-financial-integrations.controller";
import { AdminApiKeysController } from "./admin-api-keys.controller";
import { AdminWebhooksController } from "./admin-webhooks.controller";
import { AdminDevicesController } from "./admin-devices.controller";
import { AdminEntitlementsController } from "./admin-entitlements.controller";
import { AdminPaymentsController } from "./admin-payments.controller";

@Module({
  imports: [PrismaModule],
  controllers: [
    AdminSubscriptionsController,
    AdminLicensesController,
    AdminFinancialIntegrationsController,
    AdminApiKeysController,
    AdminWebhooksController,
    AdminDevicesController,
    AdminEntitlementsController,
    AdminPaymentsController,
  ],
  providers: [AdminDirectoryService, PlatformAdminGuard],
  exports: [PlatformAdminGuard],
})
export class AdminDirectoryModule {}
