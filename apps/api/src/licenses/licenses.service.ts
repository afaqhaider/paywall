import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LicenseStatus, LicenseType, Prisma, type License } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CursorQueryDto } from "../common/dto/cursor-query.dto";
import type { CreateLicenseDto } from "./dto/create-license.dto";
import type { UpdateLicenseDto } from "./dto/update-license.dto";
import type { AssignLicenseDto } from "./dto/assign-license.dto";

@Injectable()
export class LicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateLicenseDto, meta: RequestMeta) {
    const application = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
    });
    if (!application || application.organizationId !== organizationId) {
      throw new NotFoundException("Application not found in this organization");
    }

    if (dto.subscriptionId) {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: dto.subscriptionId },
      });
      if (!subscription || subscription.organizationId !== organizationId) {
        throw new NotFoundException("Subscription not found in this organization");
      }
    }

    const license = await this.prisma.license.create({
      data: {
        organizationId,
        applicationId: dto.applicationId,
        subscriptionId: dto.subscriptionId,
        type: dto.type,
        seatLimit: dto.seatLimit,
        deviceLimit: dto.deviceLimit,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        metadata: dto.metadata,
        createdById: userId,
      },
    });

    await this.auditService.record({
      action: "LICENSE_CREATED",
      userId,
      organizationId,
      applicationId: dto.applicationId,
      metadata: { licenseId: license.id, type: license.type },
      ...meta,
    });

    return license;
  }

  async list(organizationId: string, query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.license.findMany({
      where: cursorWhere ? { organizationId, ...cursorWhere } : { organizationId },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  async getOne(licenseId: string, organizationId: string): Promise<License> {
    return this.getOwned(licenseId, organizationId);
  }

  async update(
    licenseId: string,
    organizationId: string,
    userId: string,
    dto: UpdateLicenseDto,
    meta: RequestMeta,
  ) {
    await this.getOwned(licenseId, organizationId);

    const license = await this.prisma.license.update({
      where: { id: licenseId },
      data: {
        seatLimit: dto.seatLimit,
        deviceLimit: dto.deviceLimit,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        metadata: dto.metadata,
      },
    });

    await this.auditService.record({
      action: "LICENSE_UPDATED",
      userId,
      organizationId,
      metadata: { licenseId },
      ...meta,
    });

    return license;
  }

  async revoke(licenseId: string, organizationId: string, userId: string, meta: RequestMeta) {
    const license = await this.getOwned(licenseId, organizationId);

    if (license.status === LicenseStatus.REVOKED) {
      throw new BadRequestException("License is already revoked");
    }

    const revoked = await this.prisma.license.update({
      where: { id: licenseId },
      data: { status: LicenseStatus.REVOKED, revokedAt: new Date() },
    });

    await this.auditService.record({
      action: "LICENSE_REVOKED",
      userId,
      organizationId,
      metadata: { licenseId },
      ...meta,
    });

    return revoked;
  }

  async listAssignments(licenseId: string, organizationId: string) {
    await this.getOwned(licenseId, organizationId);

    return this.prisma.licenseAssignment.findMany({
      where: { licenseId },
      orderBy: { assignedAt: "desc" },
    });
  }

  /**
   * Assigns an INDIVIDUAL-type license to a user. The DB enforces one
   * LicenseAssignment row per (licenseId, userId) *ever* - not just one
   * active row - so reassigning a user who was previously unassigned from
   * this same license must reactivate their existing row rather than
   * insert a new one (a plain insert would hit the unique constraint).
   */
  async assign(
    licenseId: string,
    organizationId: string,
    userId: string,
    dto: AssignLicenseDto,
    meta: RequestMeta,
  ) {
    const license = await this.getOwned(licenseId, organizationId);

    if (license.type !== LicenseType.INDIVIDUAL) {
      throw new BadRequestException("Only INDIVIDUAL-type licenses support direct assignment");
    }
    if (license.status !== LicenseStatus.ACTIVE) {
      throw new BadRequestException("License is not active");
    }

    const existing = await this.prisma.licenseAssignment.findUnique({
      where: { licenseId_userId: { licenseId, userId: dto.userId } },
    });

    let assignment;
    if (!existing) {
      try {
        assignment = await this.prisma.licenseAssignment.create({
          data: { licenseId, userId: dto.userId },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictException("User is already assigned to this license");
        }
        throw error;
      }
    } else if (existing.unassignedAt === null) {
      throw new ConflictException("User is already assigned to this license");
    } else {
      assignment = await this.prisma.licenseAssignment.update({
        where: { id: existing.id },
        data: { assignedAt: new Date(), unassignedAt: null },
      });
    }

    await this.auditService.record({
      action: "LICENSE_UPDATED",
      userId,
      organizationId,
      metadata: { licenseId, assignedUserId: dto.userId, event: "license_assigned" },
      ...meta,
    });

    return assignment;
  }

  async unassign(
    licenseId: string,
    organizationId: string,
    targetUserId: string,
    actingUserId: string,
    meta: RequestMeta,
  ) {
    await this.getOwned(licenseId, organizationId);

    const assignment = await this.prisma.licenseAssignment.findUnique({
      where: { licenseId_userId: { licenseId, userId: targetUserId } },
    });

    if (!assignment || assignment.unassignedAt !== null) {
      throw new NotFoundException("Active license assignment not found for this user");
    }

    const updated = await this.prisma.licenseAssignment.update({
      where: { id: assignment.id },
      data: { unassignedAt: new Date() },
    });

    await this.auditService.record({
      action: "LICENSE_UPDATED",
      userId: actingUserId,
      organizationId,
      metadata: { licenseId, unassignedUserId: targetUserId, event: "license_unassigned" },
      ...meta,
    });

    return updated;
  }

  private async getOwned(licenseId: string, organizationId: string): Promise<License> {
    const license = await this.prisma.license.findUnique({ where: { id: licenseId } });
    if (!license || license.organizationId !== organizationId) {
      throw new NotFoundException("License not found");
    }
    return license;
  }
}
