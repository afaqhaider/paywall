import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CommissionsService } from "./commissions.service";
import { CreateCommissionRuleDto } from "./dto/create-commission-rule.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/commission-rules")
export class CommissionRulesController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get()
  async list() {
    return this.commissionsService.listRules();
  }

  @Post()
  async create(
    @Body() dto: CreateCommissionRuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.commissionsService.createRule(dto, user.id, extractRequestMeta(req));
  }
}
