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
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ApplicationMemberRole } from "@prisma/client";
import { ApplicationMembersService } from "./application-members.service";
import { AddApplicationMemberDto } from "./dto/add-application-member.dto";
import { UpdateApplicationMemberRoleDto } from "./dto/update-application-member-role.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/members")
export class ApplicationMembersController {
  constructor(private readonly membersService: ApplicationMembersService) {}

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.membersService.list(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post()
  async add(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddApplicationMemberDto,
    @Req() req: Request,
  ) {
    return this.membersService.add(applicationId, dto, user.id, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Patch(":membershipId")
  async updateRole(
    @Param("applicationId") applicationId: string,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApplicationMemberRoleDto,
    @Req() req: Request,
  ) {
    return this.membersService.updateRole(
      applicationId,
      membershipId,
      dto,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Delete(":membershipId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("membershipId") membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.membersService.remove(applicationId, membershipId, user.id, extractRequestMeta(req));
  }
}
