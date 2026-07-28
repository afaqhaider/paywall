import { Module } from "@nestjs/common";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { MarketplaceTaxonomyController } from "./marketplace-taxonomy.controller";
import { MarketplaceTaxonomyService } from "./marketplace-taxonomy.service";
import { MarketplaceStoreController } from "./marketplace-store.controller";
import { MarketplaceStoreService } from "./marketplace-store.service";

@Module({
  controllers: [ListingsController, MarketplaceTaxonomyController, MarketplaceStoreController],
  providers: [ListingsService, MarketplaceTaxonomyService, MarketplaceStoreService],
  exports: [ListingsService, MarketplaceStoreService],
})
export class MarketplaceModule {}
