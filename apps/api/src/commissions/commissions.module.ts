import { Module } from "@nestjs/common";
import { CommissionsService } from "./commissions.service";
import { CommissionRulesController } from "./commission-rules.controller";
import { PayoutsService } from "./payouts.service";
import { PayoutsController } from "./payouts.controller";

@Module({
  controllers: [CommissionRulesController, PayoutsController],
  providers: [CommissionsService, PayoutsService],
  exports: [CommissionsService, PayoutsService],
})
export class CommissionsModule {}
