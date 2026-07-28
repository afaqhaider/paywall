import { Injectable, NotFoundException } from "@nestjs/common";
import type { MessageTemplateType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { UpsertPlatformSettingDto } from "./dto/upsert-platform-setting.dto";
import type { CreateFeatureFlagDto } from "./dto/create-feature-flag.dto";
import type { UpdateFeatureFlagDto } from "./dto/update-feature-flag.dto";
import type { UpsertMessageTemplateDto } from "./dto/upsert-message-template.dto";
import type { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import type { UpdateAnnouncementDto } from "./dto/update-announcement.dto";
import type { ListAnnouncementsQueryDto } from "./dto/list-announcements-query.dto";

/**
 * Global platform configuration + announcements. `PlatformSetting` is one
 * generic key/value table - branding, maintenance mode, supported
 * currencies/languages, subscription defaults, and default quotas are all
 * just different keys with JSON values, the same "flexible settings table"
 * pattern `ApplicationSetting` already established per-application, applied
 * here at the platform level.
 */
@Injectable()
export class AdminConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---- Platform settings ----

  async listSettings() {
    return this.prisma.platformSetting.findMany({ orderBy: { key: "asc" } });
  }

  async getSetting(key: string) {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (!setting) {
      throw new NotFoundException(`Platform setting "${key}" not found`);
    }
    return setting;
  }

  async upsertSetting(
    key: string,
    adminUserId: string,
    dto: UpsertPlatformSettingDto,
    meta: RequestMeta,
  ) {
    const setting = await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: dto.value, updatedById: adminUserId },
      update: { value: dto.value, updatedById: adminUserId },
    });

    await this.auditService.record({
      action: "PLATFORM_SETTING_UPDATED",
      userId: adminUserId,
      metadata: { key },
      ...meta,
    });

    return setting;
  }

  // ---- Feature flags ----

  async listFeatureFlags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
  }

  async createFeatureFlag(adminUserId: string, dto: CreateFeatureFlagDto, meta: RequestMeta) {
    const flag = await this.prisma.featureFlag.create({
      data: {
        key: dto.key,
        enabled: dto.enabled ?? false,
        description: dto.description,
        rolloutPercentage: dto.rolloutPercentage,
        updatedById: adminUserId,
      },
    });

    await this.auditService.record({
      action: "FEATURE_FLAG_UPDATED",
      userId: adminUserId,
      metadata: { key: dto.key, event: "created" },
      ...meta,
    });

    return flag;
  }

  async updateFeatureFlag(
    key: string,
    adminUserId: string,
    dto: UpdateFeatureFlagDto,
    meta: RequestMeta,
  ) {
    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException(`Feature flag "${key}" not found`);
    }

    const flag = await this.prisma.featureFlag.update({
      where: { key },
      data: {
        enabled: dto.enabled,
        description: dto.description,
        rolloutPercentage: dto.rolloutPercentage,
        updatedById: adminUserId,
      },
    });

    await this.auditService.record({
      action: "FEATURE_FLAG_UPDATED",
      userId: adminUserId,
      metadata: { key, event: "updated" },
      ...meta,
    });

    return flag;
  }

  // ---- Message templates ----

  async listMessageTemplates() {
    return this.prisma.messageTemplate.findMany({ orderBy: [{ type: "asc" }, { key: "asc" }] });
  }

  async getMessageTemplate(type: MessageTemplateType, key: string) {
    const template = await this.prisma.messageTemplate.findUnique({
      where: { type_key: { type, key } },
    });
    if (!template) {
      throw new NotFoundException(`Message template "${type}/${key}" not found`);
    }
    return template;
  }

  async upsertMessageTemplate(
    type: MessageTemplateType,
    key: string,
    adminUserId: string,
    dto: UpsertMessageTemplateDto,
    meta: RequestMeta,
  ) {
    const template = await this.prisma.messageTemplate.upsert({
      where: { type_key: { type, key } },
      create: { type, key, subject: dto.subject, body: dto.body, updatedById: adminUserId },
      update: { subject: dto.subject, body: dto.body, updatedById: adminUserId },
    });

    await this.auditService.record({
      action: "MESSAGE_TEMPLATE_UPDATED",
      userId: adminUserId,
      metadata: { type, key },
      ...meta,
    });

    return template;
  }

  // ---- Announcements ----

  async listAnnouncements(query: ListAnnouncementsQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.platformAnnouncement.findMany({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(cursorWhere ?? {}),
      },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getAnnouncement(id: string) {
    const announcement = await this.prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!announcement) {
      throw new NotFoundException("Announcement not found");
    }
    return announcement;
  }

  async createAnnouncement(adminUserId: string, dto: CreateAnnouncementDto, meta: RequestMeta) {
    const announcement = await this.prisma.platformAnnouncement.create({
      data: {
        type: dto.type,
        title: dto.title,
        body: dto.body,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
        createdById: adminUserId,
      },
    });

    await this.auditService.record({
      action: "ANNOUNCEMENT_CREATED",
      userId: adminUserId,
      metadata: { announcementId: announcement.id, type: dto.type },
      ...meta,
    });

    return announcement;
  }

  async updateAnnouncement(
    id: string,
    adminUserId: string,
    dto: UpdateAnnouncementDto,
    meta: RequestMeta,
  ) {
    await this.getAnnouncement(id);

    const announcement = await this.prisma.platformAnnouncement.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        body: dto.body,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : undefined,
      },
    });

    await this.auditService.record({
      action: "ANNOUNCEMENT_UPDATED",
      userId: adminUserId,
      metadata: { announcementId: id },
      ...meta,
    });

    return announcement;
  }

  async deleteAnnouncement(id: string, adminUserId: string, meta: RequestMeta) {
    await this.getAnnouncement(id);

    await this.prisma.platformAnnouncement.delete({ where: { id } });

    await this.auditService.record({
      action: "ANNOUNCEMENT_DELETED",
      userId: adminUserId,
      metadata: { announcementId: id },
      ...meta,
    });

    return { id, deleted: true };
  }
}
