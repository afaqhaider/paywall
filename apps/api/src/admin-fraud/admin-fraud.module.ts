import { Module } from "@nestjs/common";
import { AdminFraudController } from "./admin-fraud.controller";
import { AdminFraudService } from "./admin-fraud.service";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";

@Module({
  controllers: [AdminFraudController],
  providers: [AdminFraudService, PlatformAdminGuard],
})
export class AdminFraudModule {}
