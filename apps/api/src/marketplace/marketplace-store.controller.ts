import { Controller, Get, Param, Query } from "@nestjs/common";
import { MarketplaceStoreService } from "./marketplace-store.service";
import { BrowseStoreQueryDto, SearchStoreQueryDto } from "./dto/browse-store-query.dto";
import { Public } from "../common/decorators/public.decorator";

/**
 * Public application catalogue - bypasses the global JWT guard by design
 * (this is the marketplace storefront). Only PUBLISHED + PUBLIC listings
 * are ever reachable through these routes (enforced in
 * `MarketplaceStoreService`).
 */
@Public()
@Controller("store")
export class MarketplaceStoreController {
  constructor(private readonly storeService: MarketplaceStoreService) {}

  @Get("apps")
  async browse(@Query() query: BrowseStoreQueryDto) {
    if (query.sort === "top_rated") {
      return { data: await this.storeService.topRated(), nextCursor: null };
    }
    return this.storeService.browse(query);
  }

  @Get("categories")
  async listCategories() {
    return this.storeService.listCategories();
  }

  @Get("search")
  async search(@Query() query: SearchStoreQueryDto) {
    return this.storeService.search(query);
  }

  @Get("apps/:applicationSlugOrId")
  async getListingDetail(@Param("applicationSlugOrId") applicationSlugOrId: string) {
    return this.storeService.getListingDetail(applicationSlugOrId);
  }
}
