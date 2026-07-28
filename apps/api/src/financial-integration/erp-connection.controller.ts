import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { ErpConnectionService } from "./erp-connection.service";
import { CreateErpConnectionDto } from "./dto/create-erp-connection.dto";
import { UpdateErpConnectionDto } from "./dto/update-erp-connection.dto";
import { RotateErpConnectionKeyDto } from "./dto/rotate-erp-connection-key.dto";
import { UpdateErpPermissionsDto } from "./dto/update-erp-permissions.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/financial-integration/erp-connection")
export class ErpConnectionController {
  constructor(private readonly erpConnectionService: ErpConnectionService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateErpConnectionDto,
    @Req() req: Request,
  ) {
    return this.erpConnectionService.create(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch()
  async update(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateErpConnectionDto,
    @Req() req: Request,
  ) {
    return this.erpConnectionService.update(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("test")
  async test(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.erpConnectionService.test(organizationId, user.id, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("rotate-key")
  async rotateKey(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RotateErpConnectionKeyDto,
    @Req() req: Request,
  ) {
    return this.erpConnectionService.rotateKey(
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.erpConnectionService.disconnect(organizationId, user.id, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.MEMBER)
  @Get("permissions")
  async getPermissions(@Param("organizationId") organizationId: string) {
    return this.erpConnectionService.getPermissions(organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Put("permissions")
  async updatePermissions(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateErpPermissionsDto,
    @Req() req: Request,
  ) {
    return this.erpConnectionService.updatePermissions(
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }
}
