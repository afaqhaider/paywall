import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminMonitoringService } from "./admin-monitoring.service";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";

@UseGuards(PlatformAdminGuard)
@Controller("admin/monitoring")
export class AdminMonitoringController {
  constructor(private readonly adminMonitoringService: AdminMonitoringService) {}

  @Get("overview")
  async overview() {
    return this.adminMonitoringService.overview();
  }
}
