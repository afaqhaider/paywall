import { Module } from "@nestjs/common";
import { AdminReportsController } from "./admin-reports.controller";
import { AdminReportsService } from "./admin-reports.service";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";

@Module({
  controllers: [AdminReportsController],
  providers: [AdminReportsService, PlatformAdminGuard],
})
export class AdminReportsModule {}
