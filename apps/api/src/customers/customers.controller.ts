import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
    @Req() req: Request,
  ) {
    return this.customersService.create(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string, @Query() query: CursorQueryDto) {
    return this.customersService.list(organizationId, query);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":customerId")
  async getOne(
    @Param("customerId") customerId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.customersService.getOne(customerId, organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch(":customerId")
  async update(
    @Param("customerId") customerId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCustomerDto,
    @Req() req: Request,
  ) {
    return this.customersService.update(
      customerId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }
}
