import { Module } from "@nestjs/common";
import {
  SubscriptionsController,
  SubscriptionLifecycleController,
} from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { CouponsModule } from "../coupons/coupons.module";
import { FinancialEventsModule } from "../financial-events/financial-events.module";
import { PlatformEventsModule } from "../platform-events/platform-events.module";

@Module({
  imports: [CouponsModule, FinancialEventsModule, PlatformEventsModule],
  controllers: [SubscriptionsController, SubscriptionLifecycleController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
