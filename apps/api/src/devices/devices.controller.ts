import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { DevicesService } from "./devices.service";
import { RegisterDeviceDto } from "./dto/register-device.dto";
import { DeviceQueryDto } from "./dto/device-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/applications/:applicationId/devices")
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async register(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterDeviceDto,
    @Req() req: Request,
  ) {
    return this.devicesService.register(
      organizationId,
      applicationId,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
    @Query() query: DeviceQueryDto,
  ) {
    return this.devicesService.list(organizationId, applicationId, query);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":deviceRegistrationId")
  async getOne(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
    @Param("deviceRegistrationId") deviceRegistrationId: string,
  ) {
    return this.devicesService.getOne(organizationId, applicationId, deviceRegistrationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":deviceRegistrationId/revoke")
  async revoke(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
    @Param("deviceRegistrationId") deviceRegistrationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.devicesService.revoke(
      organizationId,
      applicationId,
      deviceRegistrationId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
