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
import { AllowedOriginsService } from "./allowed-origins.service";
import { CreateAllowedOriginDto } from "./dto/create-allowed-origin.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/allowed-origins")
export class AllowedOriginsController {
  constructor(private readonly allowedOriginsService: AllowedOriginsService) {}

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.allowedOriginsService.list(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Post()
  async create(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAllowedOriginDto,
    @Req() req: Request,
  ) {
    return this.allowedOriginsService.create(applicationId, dto, user.id, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Delete(":originId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("originId") originId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.allowedOriginsService.remove(
      applicationId,
      originId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
