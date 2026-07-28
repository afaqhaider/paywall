import { Module } from "@nestjs/common";
import { LicensesController } from "./licenses.controller";
import { LicenseKeysController } from "./license-keys.controller";
import { LicensesService } from "./licenses.service";
import { LicenseKeysService } from "./license-keys.service";

@Module({
  controllers: [LicensesController, LicenseKeysController],
  providers: [LicensesService, LicenseKeysService],
  exports: [LicensesService, LicenseKeysService],
})
export class LicensesModule {}
