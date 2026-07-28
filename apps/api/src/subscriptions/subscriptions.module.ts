import { Module } from "@nestjs/common";
import {
  SubscriptionsController,
  SubscriptionLifecycleController,
} from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { CouponsModule } from "../coupons/coupons.module";
import { FinancialEventsModule } from "../financial-events/financial-events.module";

@Module({
  imports: [CouponsModule, FinancialEventsModule],
  controllers: [SubscriptionsController, SubscriptionLifecycleController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
