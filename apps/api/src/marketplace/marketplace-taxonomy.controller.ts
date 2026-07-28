import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { MarketplaceTaxonomyService } from "./marketplace-taxonomy.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateTagDto } from "./dto/create-tag.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/marketplace")
export class MarketplaceTaxonomyController {
  constructor(private readonly taxonomyService: MarketplaceTaxonomyService) {}

  @Get("categories")
  async listCategories() {
    return this.taxonomyService.listCategories();
  }

  @Post("categories")
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.taxonomyService.createCategory(dto, user.id, extractRequestMeta(req));
  }

  @Get("tags")
  async listTags() {
    return this.taxonomyService.listTags();
  }

  @Post("tags")
  async createTag(
    @Body() dto: CreateTagDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.taxonomyService.createTag(dto, user.id, extractRequestMeta(req));
  }
}
