import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ApplicationMemberRole } from "@prisma/client";
import { InvitationsService } from "./invitations.service";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/invitations")
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
    @Req() req: Request,
  ) {
    return this.invitationsService.create(applicationId, dto, user.id, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.invitationsService.list(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Delete(":invitationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param("applicationId") applicationId: string,
    @Param("invitationId") invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.invitationsService.revoke(
      applicationId,
      invitationId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post(":invitationId/resend")
  async resend(
    @Param("applicationId") applicationId: string,
    @Param("invitationId") invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.invitationsService.resend(
      applicationId,
      invitationId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
