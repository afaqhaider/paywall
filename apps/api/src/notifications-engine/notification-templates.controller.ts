import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { NotificationTemplatesService } from "./notification-templates.service";
import { CreateNotificationTemplateDto } from "./dto/create-notification-template.dto";
import { UpdateNotificationTemplateDto } from "./dto/update-notification-template.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/notification-templates")
export class NotificationTemplatesController {
  constructor(private readonly templatesService: NotificationTemplatesService) {}

  @Get()
  async list() {
    return this.templatesService.list();
  }

  @Get(":templateId")
  async getOne(@Param("templateId") templateId: string) {
    return this.templatesService.getOne(templateId);
  }

  @Post()
  async create(
    @Body() dto: CreateNotificationTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.templatesService.create(dto, user.id, extractRequestMeta(req));
  }

  @Patch(":templateId")
  async update(
    @Param("templateId") templateId: string,
    @Body() dto: UpdateNotificationTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.templatesService.update(templateId, dto, user.id, extractRequestMeta(req));
  }
}
