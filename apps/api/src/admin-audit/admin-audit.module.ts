import { Module } from "@nestjs/common";
import { AdminAuditController } from "./admin-audit.controller";
import { AdminAuditService } from "./admin-audit.service";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";

@Module({
  controllers: [AdminAuditController],
  providers: [AdminAuditService, PlatformAdminGuard],
})
export class AdminAuditModule {}
