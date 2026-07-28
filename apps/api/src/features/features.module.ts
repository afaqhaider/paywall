import { Module } from "@nestjs/common";
import {
  FeaturesController,
  FeatureController,
  PlanFeaturesController,
  EntitlementDefinitionsController,
} from "./features.controller";
import { FeaturesService } from "./features.service";
import { PlanFeaturesService } from "./plan-features.service";
import { EntitlementDefinitionsService } from "./entitlement-definitions.service";

@Module({
  controllers: [
    FeaturesController,
    FeatureController,
    PlanFeaturesController,
    EntitlementDefinitionsController,
  ],
  providers: [FeaturesService, PlanFeaturesService, EntitlementDefinitionsService],
  exports: [FeaturesService, PlanFeaturesService, EntitlementDefinitionsService],
})
export class FeaturesModule {}
