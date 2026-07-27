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
import { ApplicationDomainsService } from "./application-domains.service";
import { CreateApplicationDomainDto } from "./dto/create-application-domain.dto";
import { UpdateApplicationDomainDto } from "./dto/update-application-domain.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/domains")
export class ApplicationDomainsController {
  constructor(private readonly domainsService: ApplicationDomainsService) {}

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationDomainDto,
    @Req() req: Request,
  ) {
    return this.domainsService.create(applicationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.domainsService.list(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Patch(":domainId")
  async update(
    @Param("applicationId") applicationId: string,
    @Param("domainId") domainId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApplicationDomainDto,
    @Req() req: Request,
  ) {
    return this.domainsService.update(
      applicationId,
      domainId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Delete(":domainId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("domainId") domainId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.domainsService.remove(applicationId, domainId, user.id, extractRequestMeta(req));
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post(":domainId/verify")
  @HttpCode(HttpStatus.OK)
  async verify(
    @Param("applicationId") applicationId: string,
    @Param("domainId") domainId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.domainsService.verify(applicationId, domainId, user.id, extractRequestMeta(req));
  }
}
