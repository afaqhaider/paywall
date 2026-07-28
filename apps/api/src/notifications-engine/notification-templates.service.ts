import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateNotificationTemplateDto } from "./dto/create-notification-template.dto";
import type { UpdateNotificationTemplateDto } from "./dto/update-notification-template.dto";

@Injectable()
export class NotificationTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list() {
    return this.prisma.notificationTemplate.findMany({ orderBy: { key: "asc" } });
  }

  async getOne(templateId: string) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException("Notification template not found");
    }
    return template;
  }

  async create(dto: CreateNotificationTemplateDto, userId: string, meta: RequestMeta) {
    const existing = await this.prisma.notificationTemplate.findUnique({ where: { key: dto.key } });
    if (existing) {
      throw new ConflictException(`A notification template with key "${dto.key}" already exists`);
    }

    const template = await this.prisma.notificationTemplate.create({ data: { ...dto } });

    await this.auditService.record({
      action: "NOTIFICATION_TEMPLATE_CREATED",
      userId,
      metadata: { templateId: template.id, key: template.key },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return template;
  }

  async update(
    templateId: string,
    dto: UpdateNotificationTemplateDto,
    userId: string,
    meta: RequestMeta,
  ) {
    await this.getOne(templateId);

    if (dto.key) {
      const existing = await this.prisma.notificationTemplate.findUnique({
        where: { key: dto.key },
      });
      if (existing && existing.id !== templateId) {
        throw new ConflictException(`A notification template with key "${dto.key}" already exists`);
      }
    }

    const template = await this.prisma.notificationTemplate.update({
      where: { id: templateId },
      data: { ...dto },
    });

    await this.auditService.record({
      action: "NOTIFICATION_TEMPLATE_UPDATED",
      userId,
      metadata: { templateId: template.id },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return template;
  }
}
