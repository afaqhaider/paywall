import { Body, Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { WhiteLabelService } from "./white-label.service";
import { UpdateWhiteLabelDto } from "./dto/update-white-label.dto";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuditService } from "../audit/audit.service";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/white-label")
export class WhiteLabelController {
  constructor(
    private readonly whiteLabelService: WhiteLabelService,
    private readonly auditService: AuditService,
  ) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async get(@Param("organizationId") organizationId: string) {
    return this.whiteLabelService.getForOrganization(organizationId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Patch()
  async update(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWhiteLabelDto,
    @Req() req: Request,
  ) {
    const config = await this.whiteLabelService.upsert(organizationId, dto);

    await this.auditService.record({
      action: "WHITE_LABEL_CONFIG_UPDATED",
      userId: user.id,
      organizationId,
      metadata: { fields: Object.keys(dto) },
      ...extractRequestMeta(req),
    });

    return config;
  }
}
