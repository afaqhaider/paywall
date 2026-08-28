import { Module } from "@nestjs/common";
import {
  EntitlementGrantController,
  EntitlementGrantsController,
  EntitlementRuntimeController,
  SubscriptionEntitlementSyncController,
} from "./entitlements.controller";
import { PublicRuntimeController } from "./public-runtime.controller";
import { EntitlementGrantsService } from "./entitlement-grants.service";
import { EntitlementResolverService } from "./entitlement-resolver.service";
import { RuntimeAuthorizationService } from "./runtime-authorization.service";

@Module({
  controllers: [
    EntitlementGrantsController,
    EntitlementGrantController,
    SubscriptionEntitlementSyncController,
    EntitlementRuntimeController,
    PublicRuntimeController,
  ],
  providers: [EntitlementGrantsService, EntitlementResolverService, RuntimeAuthorizationService],
  exports: [EntitlementGrantsService, EntitlementResolverService, RuntimeAuthorizationService],
})
export class EntitlementsModule {}
