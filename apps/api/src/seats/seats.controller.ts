import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { SeatsService } from "./seats.service";
import { CreateSeatsDto } from "./dto/create-seats.dto";
import { AssignSeatDto } from "./dto/assign-seat.dto";
import { TransferSeatDto } from "./dto/transfer-seat.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/licenses/:licenseId/seats")
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async bulkCreate(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSeatsDto,
    @Req() req: Request,
  ) {
    return this.seatsService.bulkCreate(
      licenseId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get("summary")
  async summary(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.seatsService.summary(licenseId, organizationId);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get("history")
  async history(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.seatsService.listHistory(licenseId, organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("assign")
  async assign(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignSeatDto,
    @Req() req: Request,
  ) {
    return this.seatsService.assign(
      licenseId,
      organizationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("assignments/:seatAssignmentId/remove")
  async removeAssignment(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
    @Param("seatAssignmentId") seatAssignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.seatsService.removeAssignment(
      licenseId,
      organizationId,
      seatAssignmentId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("assignments/:seatAssignmentId/transfer")
  async transfer(
    @Param("licenseId") licenseId: string,
    @Param("organizationId") organizationId: string,
    @Param("seatAssignmentId") seatAssignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransferSeatDto,
    @Req() req: Request,
  ) {
    return this.seatsService.transfer(
      licenseId,
      organizationId,
      seatAssignmentId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }
}
