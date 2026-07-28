import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { LicenseKeysService } from "./license-keys.service";
import { GenerateLicenseKeyDto } from "./dto/generate-license-key.dto";
import { TransferLicenseKeyDto } from "./dto/transfer-license-key.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/licenses/:licenseId/keys")
export class LicenseKeysController {
  constructor(private readonly licenseKeysService: LicenseKeysService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async generate(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateLicenseKeyDto,
    @Req() req: Request,
  ) {
    return this.licenseKeysService.generate(
      licenseId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.licenseKeysService.list(licenseId, organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":licenseKeyId/activate")
  async activate(
    @Param("licenseKeyId") licenseKeyId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.licenseKeysService.activate(
      licenseKeyId,
      organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":licenseKeyId/revoke")
  async revoke(
    @Param("licenseKeyId") licenseKeyId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.licenseKeysService.revoke(
      licenseKeyId,
      organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":licenseKeyId/transfer")
  async transfer(
    @Param("licenseKeyId") licenseKeyId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransferLicenseKeyDto,
    @Req() req: Request,
  ) {
    return this.licenseKeysService.transfer(
      licenseKeyId,
      organizationId,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }
}
