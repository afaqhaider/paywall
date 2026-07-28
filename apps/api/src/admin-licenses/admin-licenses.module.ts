import { Module } from "@nestjs/common";
import { AdminLicensesController } from "./admin-licenses.controller";
import { AdminLicensesService } from "./admin-licenses.service";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";
import { LicensesModule } from "../licenses/licenses.module";

@Module({
  imports: [LicensesModule],
  controllers: [AdminLicensesController],
  providers: [AdminLicensesService, PlatformAdminGuard],
})
export class AdminLicensesModule {}
