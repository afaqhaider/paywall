import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { MessageTemplateType } from "@prisma/client";
import { AdminConfigService } from "./admin-config.service";
import { UpsertPlatformSettingDto } from "./dto/upsert-platform-setting.dto";
import { CreateFeatureFlagDto } from "./dto/create-feature-flag.dto";
import { UpdateFeatureFlagDto } from "./dto/update-feature-flag.dto";
import { UpsertMessageTemplateDto } from "./dto/upsert-message-template.dto";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { UpdateAnnouncementDto } from "./dto/update-announcement.dto";
import { ListAnnouncementsQueryDto } from "./dto/list-announcements-query.dto";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(PlatformAdminGuard)
@Controller("admin/config")
export class AdminConfigController {
  constructor(private readonly adminConfigService: AdminConfigService) {}

  // ---- Platform settings ----

  @Get("settings")
  async listSettings() {
    return this.adminConfigService.listSettings();
  }

  @Get("settings/:key")
  async getSetting(@Param("key") key: string) {
    return this.adminConfigService.getSetting(key);
  }

  @Put("settings/:key")
  async upsertSetting(
    @Param("key") key: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpsertPlatformSettingDto,
    @Req() req: Request,
  ) {
    return this.adminConfigService.upsertSetting(key, admin.id, dto, extractRequestMeta(req));
  }

  // ---- Feature flags ----

  @Get("feature-flags")
  async listFeatureFlags() {
    return this.adminConfigService.listFeatureFlags();
  }

  @Post("feature-flags")
  async createFeatureFlag(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateFeatureFlagDto,
    @Req() req: Request,
  ) {
    return this.adminConfigService.createFeatureFlag(admin.id, dto, extractRequestMeta(req));
  }

  @Patch("feature-flags/:key")
  async updateFeatureFlag(
    @Param("key") key: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateFeatureFlagDto,
    @Req() req: Request,
  ) {
    return this.adminConfigService.updateFeatureFlag(key, admin.id, dto, extractRequestMeta(req));
  }

  // ---- Message templates ----

  @Get("message-templates")
  async listMessageTemplates() {
    return this.adminConfigService.listMessageTemplates();
  }

  @Get("message-templates/:type/:key")
  async getMessageTemplate(
    @Param("type", new ParseEnumPipe(MessageTemplateType)) type: MessageTemplateType,
    @Param("key") key: string,
  ) {
    return this.adminConfigService.getMessageTemplate(type, key);
  }

  @Put("message-templates/:type/:key")
  async upsertMessageTemplate(
    @Param("type", new ParseEnumPipe(MessageTemplateType)) type: MessageTemplateType,
    @Param("key") key: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpsertMessageTemplateDto,
    @Req() req: Request,
  ) {
    return this.adminConfigService.upsertMessageTemplate(
      type,
      key,
      admin.id,
      dto,
      extractRequestMeta(req),
    );
  }

  // ---- Announcements ----

  @Get("announcements")
  async listAnnouncements(@Query() query: ListAnnouncementsQueryDto) {
    return this.adminConfigService.listAnnouncements(query);
  }

  @Get("announcements/:id")
  async getAnnouncement(@Param("id") id: string) {
    return this.adminConfigService.getAnnouncement(id);
  }

  @Post("announcements")
  async createAnnouncement(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
    @Req() req: Request,
  ) {
    return this.adminConfigService.createAnnouncement(admin.id, dto, extractRequestMeta(req));
  }

  @Patch("announcements/:id")
  async updateAnnouncement(
    @Param("id") id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateAnnouncementDto,
    @Req() req: Request,
  ) {
    return this.adminConfigService.updateAnnouncement(id, admin.id, dto, extractRequestMeta(req));
  }

  @Delete("announcements/:id")
  async deleteAnnouncement(
    @Param("id") id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.adminConfigService.deleteAnnouncement(id, admin.id, extractRequestMeta(req));
  }
}
