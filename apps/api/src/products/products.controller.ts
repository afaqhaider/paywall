import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
    @Req() req: Request,
  ) {
    return this.productsService.create(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string, @Query() query: CursorQueryDto) {
    return this.productsService.list(organizationId, query);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":productId")
  async getOne(
    @Param("productId") productId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.productsService.getOne(productId, organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch(":productId")
  async update(
    @Param("productId") productId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProductDto,
    @Req() req: Request,
  ) {
    return this.productsService.update(
      productId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":productId/archive")
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param("productId") productId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.productsService.archive(
      productId,
      organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":productId/restore")
  @HttpCode(HttpStatus.OK)
  async restore(
    @Param("productId") productId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.productsService.restore(
      productId,
      organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
