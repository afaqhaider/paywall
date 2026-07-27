import { Injectable, NotFoundException } from "@nestjs/common";
import { ApplicationMemberRole, ApplicationStatus, ApplicationVisibility } from "@prisma/client";
import { OrganizationRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { roleAtLeast } from "../common/utils/org-role.util";
import { slugify } from "../common/utils/slug.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateApplicationDto } from "./dto/create-application.dto";
import type { UpdateApplicationDto } from "./dto/update-application.dto";
import type { ListApplicationsQueryDto } from "./dto/list-applications-query.dto";

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateApplicationDto,
    meta: RequestMeta,
  ) {
    const slug = await this.generateUniqueSlug(dto.name);

    const application = await this.prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          organizationId,
          name: dto.name,
          slug,
          displayName: dto.displayName,
          description: dto.description,
          category: dto.category,
          bundleIdentifier: dto.bundleIdentifier,
          packageName: dto.packageName,
          webIdentifier: dto.webIdentifier,
          logoUrl: dto.logoUrl,
          iconUrl: dto.iconUrl,
          primaryColor: dto.primaryColor,
          visibility: dto.visibility ?? ApplicationVisibility.PRIVATE,
          createdById: userId,
        },
      });

      await tx.applicationMember.create({
        data: { applicationId: app.id, userId, role: ApplicationMemberRole.OWNER },
      });

      return app;
    });

    await this.auditService.record({
      action: "APPLICATION_CREATED",
      userId,
      organizationId,
      applicationId: application.id,
      ...meta,
    });

    return application;
  }

  async listForOrganization(
    organizationId: string,
    userId: string,
    query: ListApplicationsQueryDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const orgMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    const isOrgAdmin = orgMembership
      ? roleAtLeast(orgMembership.role, OrganizationRole.ADMINISTRATOR)
      : false;

    const where: Prisma.ApplicationWhereInput = isOrgAdmin
      ? { organizationId }
      : {
          organizationId,
          OR: [{ visibility: ApplicationVisibility.INTERNAL }, { members: { some: { userId } } }],
        };

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.application.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getOne(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { _count: { select: { members: true, versions: true, domains: true } } },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    return application;
  }

  async update(
    applicationId: string,
    organizationId: string,
    userId: string,
    dto: UpdateApplicationDto,
    meta: RequestMeta,
  ) {
    const application = await this.prisma.application.update({
      where: { id: applicationId },
      data: { ...dto },
    });

    await this.auditService.record({
      action: "APPLICATION_UPDATED",
      userId,
      organizationId,
      applicationId,
      ...meta,
    });

    return application;
  }

  async archive(applicationId: string, organizationId: string, userId: string, meta: RequestMeta) {
    const application = await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.ARCHIVED, archivedAt: new Date() },
    });

    await this.auditService.record({
      action: "APPLICATION_ARCHIVED",
      userId,
      organizationId,
      applicationId,
      ...meta,
    });

    return application;
  }

  async restore(applicationId: string, organizationId: string, userId: string, meta: RequestMeta) {
    const application = await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.ACTIVE, archivedAt: null },
    });

    await this.auditService.record({
      action: "APPLICATION_RESTORED",
      userId,
      organizationId,
      applicationId,
      ...meta,
    });

    return application;
  }

  async remove(applicationId: string, organizationId: string, userId: string, meta: RequestMeta) {
    // Record before deleting: AuditLog.applicationId is a real foreign key,
    // so a row referencing this application inserted AFTER it's gone would
    // fail the constraint rather than simply carry a null reference.
    await this.auditService.record({
      action: "APPLICATION_DELETED",
      userId,
      organizationId,
      applicationId,
      ...meta,
    });

    await this.prisma.application.delete({ where: { id: applicationId } });
  }

  async listAuditLogs(applicationId: string) {
    return this.auditService.listForApplication(applicationId);
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || "app";
    let candidate = base;
    let suffix = 1;

    while (await this.prisma.application.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }
}
