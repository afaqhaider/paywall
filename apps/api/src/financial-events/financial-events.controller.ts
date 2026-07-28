import {
  Body,
  Controller,
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
import { OrganizationRole } from "@prisma/client";
import { FinancialEventsService } from "./financial-events.service";
import { CreateFinancialEventDto } from "./dto/create-financial-event.dto";
import { ListFinancialEventsQueryDto } from "./dto/list-financial-events-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/financial-events")
export class FinancialEventsController {
  constructor(private readonly financialEventsService: FinancialEventsService) {}

  /**
   * Records a financial event and returns immediately (202) - the sync to
   * the configured provider (INTERNAL or LEDGIX_ERP) happens asynchronously
   * via `SyncEngineService`'s periodic sweep, never on this request path.
   */
  @RequireOrgRole(OrganizationRole.MEMBER)
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFinancialEventDto,
    @Req() req: Request,
  ) {
    return this.financialEventsService.record(
      organizationId,
      dto.type,
      dto.payload,
      {
        applicationId: dto.applicationId,
        customerId: dto.customerId,
        subscriptionId: dto.subscriptionId,
      },
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.MEMBER)
  @Get()
  async list(
    @Param("organizationId") organizationId: string,
    @Query() query: ListFinancialEventsQueryDto,
  ) {
    return this.financialEventsService.list(organizationId, query);
  }
}
