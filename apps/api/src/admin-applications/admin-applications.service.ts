import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ApplicationStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { AdminApplicationQueryDto } from "./dto/admin-application-query.dto";
import type { MoveApplicationDto } from "./dto/move-application.dto";

/** Same "never return the encrypted/hashed columns" contract as `application-secrets.controller.ts` and every APIKey read in this codebase - a select shape, not a post-hoc strip, so a forgotten field can never leak by accident. */
const SECRET_METADATA_SELECT = {
  id: true,
  applicationId: true,
  environmentId: true,
  type: true,
  key: true,
  lastFour: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  rotatedAt: true,
} as const;

const API_KEY_METADATA_SELECT = {
  id: true,
  apiClientId: true,
  name: true,
  keyPrefix: true,
  lastFour: true,
  rateLimitPerMin: true,
  expiresAt: true,
  revokedAt: true,
  rotatedAt: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: AdminApplicationQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.application.findMany({
      where: {
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { slug: { contains: query.search, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(cursorWhere ?? {}),
      },
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    const page = paginateResults(rows, limit);
    return {
      ...page,
      items: page.items.map((app) => ({
        id: app.id,
        name: app.name,
        slug: app.slug,
        status: app.status,
        organizationId: app.organizationId,
        organizationName: app.organization.name,
        createdAt: app.createdAt,
      })),
    };
  }

  async getOne(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        versions: { orderBy: { createdAt: "desc" } },
        environments: true,
        webhookEndpoints: true, // never includes its `secrets` relation - "strip secrets" by simply not asking Prisma for them.
        apiClients: { include: { apiKeys: { select: API_KEY_METADATA_SELECT } } },
        secrets: { select: SECRET_METADATA_SELECT },
      },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    return application;
  }

  async suspend(applicationId: string, adminUserId: string, meta: RequestMeta) {
    await this.getOrThrow(applicationId);

    const application = await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.SUSPENDED },
    });

    await this.auditService.record({
      action: "APPLICATION_SUSPENDED_BY_ADMIN",
      userId: adminUserId,
      applicationId,
      ...meta,
    });

    return application;
  }

  async restore(applicationId: string, adminUserId: string, meta: RequestMeta) {
    await this.getOrThrow(applicationId);

    const application = await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.ACTIVE },
    });

    await this.auditService.record({
      action: "APPLICATION_RESTORED",
      userId: adminUserId,
      applicationId,
      ...meta,
    });

    return application;
  }

  async archive(applicationId: string, adminUserId: string, meta: RequestMeta) {
    await this.getOrThrow(applicationId);

    const application = await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.ARCHIVED, archivedAt: new Date() },
    });

    await this.auditService.record({
      action: "APPLICATION_ARCHIVED",
      userId: adminUserId,
      applicationId,
      ...meta,
    });

    return application;
  }

  async move(
    applicationId: string,
    dto: MoveApplicationDto,
    adminUserId: string,
    meta: RequestMeta,
  ) {
    const application = await this.getOrThrow(applicationId);

    const targetOrganization = await this.prisma.organization.findUnique({
      where: { id: dto.targetOrganizationId },
    });
    if (!targetOrganization) {
      throw new NotFoundException("Target organization not found");
    }

    try {
      const updated = await this.prisma.application.update({
        where: { id: applicationId },
        data: { organizationId: dto.targetOrganizationId },
      });

      await this.auditService.record({
        action: "APPLICATION_MOVED_TO_ORGANIZATION",
        userId: adminUserId,
        applicationId,
        organizationId: dto.targetOrganizationId,
        metadata: { fromOrganizationId: application.organizationId },
        ...meta,
      });

      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Application move conflicts with a unique constraint");
      }
      throw error;
    }
  }

  private async getOrThrow(applicationId: string) {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) {
      throw new NotFoundException("Application not found");
    }
    return application;
  }
}
