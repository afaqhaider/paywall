import { Module } from "@nestjs/common";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { EntitlementsModule } from "../entitlements/entitlements.module";
import { ProfileService } from "../profile/profile.service";
import { CustomerOwnershipService } from "./customer-ownership.service";
import { MeCustomersService } from "./me-customers.service";
import { MeController } from "./me.controller";
import { CustomerDashboardService } from "./customer-dashboard.service";
import { CustomerDashboardController } from "./customer-dashboard.controller";
import { CustomerSubscriptionsService } from "./customer-subscriptions.service";
import { CustomerSubscriptionsController } from "./customer-subscriptions.controller";
import { CustomerLicensesService } from "./customer-licenses.service";
import { CustomerLicensesController } from "./customer-licenses.controller";
import { CustomerDevicesService } from "./customer-devices.service";
import { CustomerDevicesController } from "./customer-devices.controller";
import { CustomerFinancialsService } from "./customer-financials.service";
import { CustomerFinancialsController } from "./customer-financials.controller";
import { CustomerUsageService } from "./customer-usage.service";
import { CustomerUsageController } from "./customer-usage.controller";

@Module({
  // `SubscriptionsModule`/`EntitlementsModule` already export the services
  // this module wraps - reused as-is, never reimplemented. `ProfileService`
  // is provided directly below (see note there) rather than importing
  // `ProfileModule`, which doesn't export it and is out of scope to edit.
  imports: [SubscriptionsModule, EntitlementsModule],
  controllers: [
    MeController,
    CustomerDashboardController,
    CustomerSubscriptionsController,
    CustomerLicensesController,
    CustomerDevicesController,
    CustomerFinancialsController,
    CustomerUsageController,
  ],
  providers: [
    CustomerOwnershipService,
    MeCustomersService,
    // `ProfileModule` doesn't export `ProfileService`, and it's a previous-
    // phase module out of scope to edit here - providing the (stateless,
    // Prisma+Audit-only) class directly gives this module its own instance
    // without touching profile.module.ts.
    ProfileService,
    CustomerDashboardService,
    CustomerSubscriptionsService,
    CustomerLicensesService,
    CustomerDevicesService,
    CustomerFinancialsService,
    CustomerUsageService,
  ],
})
export class CustomerPortalModule {}
