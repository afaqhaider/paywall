import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { ProductPlansController, PlansController } from "./plans.controller";
import { PlansService } from "./plans.service";
import { PlanPricesController, PricesController } from "./prices.controller";
import { PricesService } from "./prices.service";

@Module({
  controllers: [
    ProductsController,
    ProductPlansController,
    PlansController,
    PlanPricesController,
    PricesController,
  ],
  providers: [ProductsService, PlansService, PricesService],
  exports: [ProductsService, PlansService, PricesService],
})
export class ProductsModule {}
