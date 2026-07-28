import { Module } from "@nestjs/common";
import { CouponsController, PromotionCodesController } from "./coupons.controller";
import { CouponsService } from "./coupons.service";
import { PromotionCodesService } from "./promotion-codes.service";

@Module({
  controllers: [CouponsController, PromotionCodesController],
  providers: [CouponsService, PromotionCodesService],
  exports: [CouponsService, PromotionCodesService],
})
export class CouponsModule {}
