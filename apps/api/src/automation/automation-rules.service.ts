import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateAutomationRuleDto } from "./dto/create-automation-rule.dto";
import type { UpdateAutomationRuleDto } from "./dto/update-automation-rule.dto";
import type { ToggleAutomationRuleDto } from "./dto/toggle-automation-rule.dto";

@Injectable()
export class AutomationRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list() {
    return this.prisma.automationRule.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getOne(ruleId: string) {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id: ruleId },
      include: { executions: { orderBy: { startedAt: "desc" }, take: 50 } },
    });
    if (!rule) {
      throw new NotFoundException("Automation rule not found");
    }
    return rule;
  }

  async create(dto: CreateAutomationRuleDto, userId: string, meta: RequestMeta) {
    const rule = await this.prisma.automationRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        triggerEventType: dto.triggerEventType,
        actions: dto.actions as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    await this.auditService.record({
      action: "AUTOMATION_RULE_CREATED",
      userId,
      metadata: { ruleId: rule.id, triggerEventType: rule.triggerEventType },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return rule;
  }

  async update(ruleId: string, dto: UpdateAutomationRuleDto, userId: string, meta: RequestMeta) {
    await this.getOne(ruleId);

    const rule = await this.prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        name: dto.name,
        description: dto.description,
        triggerEventType: dto.triggerEventType,
        actions: dto.actions as Prisma.InputJsonValue | undefined,
        enabled: dto.enabled,
      },
    });

    await this.auditService.record({
      action: "AUTOMATION_RULE_UPDATED",
      userId,
      metadata: { ruleId: rule.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return rule;
  }

  async toggle(ruleId: string, dto: ToggleAutomationRuleDto, userId: string, meta: RequestMeta) {
    await this.getOne(ruleId);

    const rule = await this.prisma.automationRule.update({
      where: { id: ruleId },
      data: { enabled: dto.enabled },
    });

    await this.auditService.record({
      action: "AUTOMATION_RULE_TOGGLED",
      userId,
      metadata: { ruleId: rule.id, enabled: rule.enabled },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return rule;
  }
}
