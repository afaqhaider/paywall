import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { AdminOrganizationsService } from "./admin-organizations.service";
import { AdminOrganizationQueryDto } from "./dto/admin-organization-query.dto";
import { SuspendOrganizationDto } from "./dto/suspend-organization.dto";
import { TransferOwnershipDto } from "./dto/transfer-ownership.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/organizations")
export class AdminOrganizationsController {
  constructor(private readonly adminOrganizationsService: AdminOrganizationsService) {}

  @Get()
  async list(@Query() query: AdminOrganizationQueryDto) {
    return this.adminOrganizationsService.list(query);
  }

  @Get(":organizationId")
  async getOne(@Param("organizationId") organizationId: string) {
    return this.adminOrganizationsService.getOne(organizationId);
  }

  @Post(":organizationId/suspend")
  async suspend(
    @Param("organizationId") organizationId: string,
    @Body() dto: SuspendOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminOrganizationsService.suspend(
      organizationId,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }

  @Post(":organizationId/reactivate")
  async reactivate(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminOrganizationsService.reactivate(
      organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @Post(":organizationId/archive")
  async archive(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminOrganizationsService.archive(organizationId, user.id, extractRequestMeta(req));
  }

  @Delete(":organizationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.adminOrganizationsService.softDelete(
      organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @Post(":organizationId/transfer-ownership")
  async transferOwnership(
    @Param("organizationId") organizationId: string,
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminOrganizationsService.transferOwnership(
      organizationId,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }
}
