import { Module } from "@nestjs/common";
import { AdminMonitoringController } from "./admin-monitoring.controller";
import { AdminMonitoringService } from "./admin-monitoring.service";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";
import { HealthModule } from "../health/health.module";

@Module({
  imports: [HealthModule],
  controllers: [AdminMonitoringController],
  providers: [AdminMonitoringService, PlatformAdminGuard],
})
export class AdminMonitoringModule {}
