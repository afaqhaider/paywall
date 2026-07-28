import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AutomationRulesService } from "./automation-rules.service";
import { CreateAutomationRuleDto } from "./dto/create-automation-rule.dto";
import { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";
import { ToggleAutomationRuleDto } from "./dto/toggle-automation-rule.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/automation-rules")
export class AutomationRulesController {
  constructor(private readonly rulesService: AutomationRulesService) {}

  @Get()
  async list() {
    return this.rulesService.list();
  }

  @Get(":ruleId")
  async getOne(@Param("ruleId") ruleId: string) {
    return this.rulesService.getOne(ruleId);
  }

  @Post()
  async create(
    @Body() dto: CreateAutomationRuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rulesService.create(dto, user.id, extractRequestMeta(req));
  }

  @Patch(":ruleId")
  async update(
    @Param("ruleId") ruleId: string,
    @Body() dto: UpdateAutomationRuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rulesService.update(ruleId, dto, user.id, extractRequestMeta(req));
  }

  @Patch(":ruleId/toggle")
  async toggle(
    @Param("ruleId") ruleId: string,
    @Body() dto: ToggleAutomationRuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.rulesService.toggle(ruleId, dto, user.id, extractRequestMeta(req));
  }
}
