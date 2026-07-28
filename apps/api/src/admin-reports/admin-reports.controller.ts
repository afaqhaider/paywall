import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminReportsService } from "./admin-reports.service";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";

@UseGuards(PlatformAdminGuard)
@Controller("admin/reports")
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get("organizations")
  async organizations() {
    return this.adminReportsService.organizations();
  }

  @Get("applications")
  async applications() {
    return this.adminReportsService.applications();
  }

  @Get("revenue")
  async revenue() {
    return this.adminReportsService.revenue();
  }

  @Get("subscriptions")
  async subscriptions() {
    return this.adminReportsService.subscriptionsByStatus();
  }

  @Get("payments")
  async payments() {
    return this.adminReportsService.paymentsByStatus();
  }

  @Get("erp-integrations")
  async erpIntegrations() {
    return this.adminReportsService.erpIntegrations();
  }

  @Get("api-usage")
  async apiUsage() {
    return this.adminReportsService.apiUsage();
  }

  @Get("customer-growth")
  async customerGrowth() {
    return this.adminReportsService.customerGrowth();
  }

  @Get("developer-growth")
  async developerGrowth() {
    return this.adminReportsService.developerGrowth();
  }

  /** No storage system exists in this platform - see AdminReportsService.storageUsage. */
  @Get("storage-usage")
  storageUsage() {
    return this.adminReportsService.storageUsage();
  }
}
