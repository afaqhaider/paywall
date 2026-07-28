import { Controller, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { InvitationsService } from "./invitations.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

/**
 * Unscoped acceptance endpoint - the accepting user isn't an
 * ApplicationMember yet, so ApplicationRoleGuard cannot apply here. The
 * global JwtAuthGuard still requires the caller to be logged in.
 */
@Controller("invitations")
export class InvitationAcceptanceController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post(":token/accept")
  async accept(
    @Param("token") token: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.invitationsService.accept(token, user, extractRequestMeta(req));
  }
}
