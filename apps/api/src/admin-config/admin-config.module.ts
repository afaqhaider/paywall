import { Module } from "@nestjs/common";
import { AdminConfigController } from "./admin-config.controller";
import { AdminConfigService } from "./admin-config.service";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";

@Module({
  controllers: [AdminConfigController],
  providers: [AdminConfigService, PlatformAdminGuard],
})
export class AdminConfigModule {}
