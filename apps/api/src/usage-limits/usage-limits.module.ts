import { Module } from "@nestjs/common";
import { UsageLimitsController } from "./usage-limits.controller";
import { UsageLimitsService } from "./usage-limits.service";
import { EntitlementsModule } from "../entitlements/entitlements.module";

@Module({
  imports: [EntitlementsModule],
  controllers: [UsageLimitsController],
  providers: [UsageLimitsService],
  exports: [UsageLimitsService],
})
export class UsageLimitsModule {}
