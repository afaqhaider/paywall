import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { OrganizationRole, OrganizationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { AdminOrganizationQueryDto } from "./dto/admin-organization-query.dto";
import type { SuspendOrganizationDto } from "./dto/suspend-organization.dto";
import type { TransferOwnershipDto } from "./dto/transfer-ownership.dto";

const MEMBER_USER_SELECT = {
  id: true,
  email: true,
  displayName: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class AdminOrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Server-side paginated search across EVERY organization, regardless of the caller's own membership. */
  async list(query: AdminOrganizationQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.organization.findMany({
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
      include: { _count: { select: { members: true, applications: true } } },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    const page = paginateResults(rows, limit);
    return {
      ...page,
      items: page.items.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        memberCount: org._count.members,
        applicationCount: org._count.applications,
        createdAt: org.createdAt,
      })),
    };
  }

  async getOne(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          include: { user: { select: MEMBER_USER_SELECT } },
          orderBy: { createdAt: "asc" },
        },
        _count: { select: { applications: true } },
        financialIntegration: { include: { erpConnection: true } },
      },
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    const apiUsageCount = await this.prisma.accessLog.count({ where: { organizationId } });

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      suspendedAt: organization.suspendedAt,
      suspensionReason: organization.suspensionReason,
      archivedAt: organization.archivedAt,
      deletedAt: organization.deletedAt,
      createdAt: organization.createdAt,
      applicationCount: organization._count.applications,
      members: organization.members.map((m) => ({
        membershipId: m.id,
        role: m.role,
        joinedAt: m.createdAt,
        user: m.user,
      })),
      financialMode: organization.financialIntegration?.provider ?? "INTERNAL",
      erpStatus: organization.financialIntegration?.erpConnection?.status ?? null,
      apiUsageCount,
      // Honest answer: this platform has no file-storage subsystem at all
      // (no model, no bucket, no upload endpoint) - a "storage usage" number
      // here would be fabricated. Report it as untracked instead.
      storageUsage: "not tracked",
    };
  }

  async suspend(
    organizationId: string,
    dto: SuspendOrganizationDto,
    adminUserId: string,
    meta: RequestMeta,
  ) {
    await this.getOrThrow(organizationId);

    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: OrganizationStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspensionReason: dto.reason,
      },
    });

    await this.auditService.record({
      action: "ORGANIZATION_SUSPENDED",
      userId: adminUserId,
      organizationId,
      metadata: { reason: dto.reason },
      ...meta,
    });

    return organization;
  }

  async reactivate(organizationId: string, adminUserId: string, meta: RequestMeta) {
    await this.getOrThrow(organizationId);

    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: OrganizationStatus.ACTIVE, suspendedAt: null, suspensionReason: null },
    });

    await this.auditService.record({
      action: "ORGANIZATION_REACTIVATED",
      userId: adminUserId,
      organizationId,
      ...meta,
    });

    return organization;
  }

  async archive(organizationId: string, adminUserId: string, meta: RequestMeta) {
    await this.getOrThrow(organizationId);

    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: OrganizationStatus.ARCHIVED, archivedAt: new Date() },
    });

    await this.auditService.record({
      action: "ORGANIZATION_ARCHIVED",
      userId: adminUserId,
      organizationId,
      ...meta,
    });

    return organization;
  }

  /** Soft delete only - per spec, never hard-deletes or cascade-deletes the row. */
  async softDelete(organizationId: string, adminUserId: string, meta: RequestMeta) {
    await this.getOrThrow(organizationId);

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { status: OrganizationStatus.DELETED, deletedAt: new Date() },
    });

    await this.auditService.record({
      action: "ORGANIZATION_SOFT_DELETED",
      userId: adminUserId,
      organizationId,
      ...meta,
    });
  }

  /** Assigns OWNER to `newOwnerUserId` (creating a membership if needed) and demotes any prior OWNER(s) to ADMINISTRATOR so the organization is never left without an admin. */
  async transferOwnership(
    organizationId: string,
    dto: TransferOwnershipDto,
    adminUserId: string,
    meta: RequestMeta,
  ) {
    await this.getOrThrow(organizationId);

    const newOwnerUser = await this.prisma.user.findUnique({ where: { id: dto.newOwnerUserId } });
    if (!newOwnerUser) {
      throw new BadRequestException("Target user not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationMember.updateMany({
        where: {
          organizationId,
          role: OrganizationRole.OWNER,
          userId: { not: dto.newOwnerUserId },
        },
        data: { role: OrganizationRole.ADMINISTRATOR },
      });

      await tx.organizationMember.upsert({
        where: { organizationId_userId: { organizationId, userId: dto.newOwnerUserId } },
        update: { role: OrganizationRole.OWNER },
        create: { organizationId, userId: dto.newOwnerUserId, role: OrganizationRole.OWNER },
      });
    });

    await this.auditService.record({
      action: "ORGANIZATION_OWNERSHIP_TRANSFERRED",
      userId: adminUserId,
      organizationId,
      metadata: { newOwnerUserId: dto.newOwnerUserId },
      ...meta,
    });

    return this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: dto.newOwnerUserId } },
    });
  }

  private async getOrThrow(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
    return organization;
  }
}
