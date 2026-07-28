import { Module } from "@nestjs/common";
import { AdminFinancialController } from "./admin-financial.controller";
import { AdminFinancialService } from "./admin-financial.service";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";

@Module({
  controllers: [AdminFinancialController],
  providers: [AdminFinancialService, PlatformAdminGuard],
})
export class AdminFinancialModule {}
