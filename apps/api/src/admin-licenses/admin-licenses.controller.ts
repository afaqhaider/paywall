import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AdminLicensesService } from "./admin-licenses.service";
import { CreateAdminLicenseDto } from "./dto/create-admin-license.dto";
import { TransferAdminLicenseDto } from "./dto/transfer-admin-license.dto";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/licenses")
export class AdminLicensesController {
  constructor(private readonly adminLicensesService: AdminLicensesService) {}

  @Post()
  async create(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateAdminLicenseDto,
    @Req() req: Request,
  ) {
    return this.adminLicensesService.create(admin.id, dto, extractRequestMeta(req));
  }

  @Post(":licenseId/transfer")
  async transfer(
    @Param("licenseId") licenseId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: TransferAdminLicenseDto,
    @Req() req: Request,
  ) {
    return this.adminLicensesService.transfer(licenseId, admin.id, dto, extractRequestMeta(req));
  }

  @Post(":licenseId/deactivate")
  async deactivate(
    @Param("licenseId") licenseId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminLicensesService.deactivate(licenseId, admin.id, extractRequestMeta(req));
  }

  @Post(":licenseId/reactivate")
  async reactivate(
    @Param("licenseId") licenseId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminLicensesService.reactivate(licenseId, admin.id, extractRequestMeta(req));
  }

  @Post(":licenseId/revoke")
  async revoke(
    @Param("licenseId") licenseId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminLicensesService.revoke(licenseId, admin.id, extractRequestMeta(req));
  }
}
