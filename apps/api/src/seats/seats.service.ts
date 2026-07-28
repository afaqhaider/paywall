import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LicenseType, SeatAssignmentStatus, SeatStatus, type License } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateSeatsDto } from "./dto/create-seats.dto";
import type { AssignSeatDto } from "./dto/assign-seat.dto";
import type { TransferSeatDto } from "./dto/transfer-seat.dto";

@Injectable()
export class SeatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Bulk-creates AVAILABLE seat slots under a SEAT-type license, capped at
   * `License.seatLimit` - a license with no seatLimit set is treated as
   * unlimited (matches how `seatLimit`/`deviceLimit` are optional elsewhere
   * in this schema). */
  async bulkCreate(
    licenseId: string,
    organizationId: string,
    userId: string,
    dto: CreateSeatsDto,
    meta: RequestMeta,
  ) {
    const license = await this.getOwnedSeatLicense(licenseId, organizationId);

    const existingCount = await this.prisma.seat.count({ where: { licenseId } });
    if (license.seatLimit != null && existingCount + dto.count > license.seatLimit) {
      throw new BadRequestException(
        `Creating ${dto.count} seat(s) would exceed this license's seat limit of ` +
          `${license.seatLimit} (${existingCount} already exist)`,
      );
    }

    const created = await this.prisma.seat.createManyAndReturn({
      data: Array.from({ length: dto.count }, () => ({ licenseId })),
    });

    await this.auditService.record({
      action: "SEAT_ASSIGNED",
      userId,
      organizationId,
      applicationId: license.applicationId,
      metadata: { licenseId, event: "seats_created", count: dto.count },
      ...meta,
    });

    return created;
  }

  /**
   * Assigns the next AVAILABLE seat under a license to a user. This is the
   * core "never exceed purchased seats" invariant (the seat-based analogue
   * of `OrganizationsService`'s last-owner protection): the flip from
   * AVAILABLE to ASSIGNED is done via `updateMany` conditioned on
   * `status: AVAILABLE` rather than a plain `update`, so it's a
   * compare-and-swap - if two requests race for the same last available
   * seat, only one `updateMany` actually changes a row (Postgres serializes
   * the two UPDATEs via row locking and the loser's WHERE no longer
   * matches), and the loser gets a clean 409 instead of a double
   * assignment.
   */
  async assign(
    licenseId: string,
    organizationId: string,
    actingUserId: string,
    dto: AssignSeatDto,
    meta: RequestMeta,
  ) {
    const license = await this.getOwnedSeatLicense(licenseId, organizationId);

    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = await this.prisma.seat.findFirst({
        where: { licenseId, status: SeatStatus.AVAILABLE },
        orderBy: { createdAt: "asc" },
      });

      if (!candidate) {
        throw new ConflictException("No available seats remain on this license");
      }

      const claim = await this.prisma.seat.updateMany({
        where: { id: candidate.id, status: SeatStatus.AVAILABLE },
        data: { status: SeatStatus.ASSIGNED },
      });

      if (claim.count === 0) {
        // Another request claimed this seat first - retry against the next candidate.
        continue;
      }

      const assignment = await this.prisma.seatAssignment.create({
        data: { seatId: candidate.id, userId: dto.userId, status: SeatAssignmentStatus.ACTIVE },
      });

      await this.auditService.record({
        action: "SEAT_ASSIGNED",
        userId: actingUserId,
        organizationId,
        applicationId: license.applicationId,
        metadata: { licenseId, seatId: candidate.id, assignedUserId: dto.userId },
        ...meta,
      });

      return { ...assignment, seat: { ...candidate, status: SeatStatus.ASSIGNED } };
    }

    throw new ConflictException("Could not assign a seat, please retry");
  }

  async removeAssignment(
    licenseId: string,
    organizationId: string,
    seatAssignmentId: string,
    actingUserId: string,
    meta: RequestMeta,
  ) {
    const license = await this.getOwnedSeatLicense(licenseId, organizationId);
    const assignment = await this.getOwnedActiveAssignment(licenseId, seatAssignmentId);

    const updated = await this.prisma.seatAssignment.update({
      where: { id: assignment.id },
      data: { status: SeatAssignmentStatus.REMOVED, unassignedAt: new Date() },
    });
    await this.prisma.seat.update({
      where: { id: assignment.seatId },
      data: { status: SeatStatus.AVAILABLE },
    });

    await this.auditService.record({
      action: "SEAT_REMOVED",
      userId: actingUserId,
      organizationId,
      applicationId: license.applicationId,
      metadata: { licenseId, seatId: assignment.seatId, unassignedUserId: assignment.userId },
      ...meta,
    });

    return updated;
  }

  /** Transfers an occupied seat to a new user. Per the spec, this creates a
   * NEW SeatAssignment row for the new user rather than mutating the old
   * one (marking the old row TRANSFERRED instead) so seat occupancy history
   * stays fully reconstructable - the same append-only pattern
   * `SubscriptionEvent`/`EntitlementGrantEvent` use elsewhere. The seat
   * itself stays ASSIGNED throughout since it's never unoccupied. */
  async transfer(
    licenseId: string,
    organizationId: string,
    seatAssignmentId: string,
    actingUserId: string,
    dto: TransferSeatDto,
    meta: RequestMeta,
  ) {
    const license = await this.getOwnedSeatLicense(licenseId, organizationId);
    const assignment = await this.getOwnedActiveAssignment(licenseId, seatAssignmentId);

    const [, newAssignment] = await this.prisma.$transaction([
      this.prisma.seatAssignment.update({
        where: { id: assignment.id },
        data: { status: SeatAssignmentStatus.TRANSFERRED, unassignedAt: new Date() },
      }),
      this.prisma.seatAssignment.create({
        data: {
          seatId: assignment.seatId,
          userId: dto.userId,
          status: SeatAssignmentStatus.ACTIVE,
        },
      }),
    ]);

    await this.auditService.record({
      action: "SEAT_TRANSFERRED",
      userId: actingUserId,
      organizationId,
      applicationId: license.applicationId,
      metadata: {
        licenseId,
        seatId: assignment.seatId,
        fromUserId: assignment.userId,
        toUserId: dto.userId,
      },
      ...meta,
    });

    return newAssignment;
  }

  async listHistory(licenseId: string, organizationId: string) {
    await this.getOwnedSeatLicense(licenseId, organizationId);

    return this.prisma.seatAssignment.findMany({
      where: { seat: { licenseId } },
      include: { seat: true },
      orderBy: { assignedAt: "desc" },
    });
  }

  async summary(licenseId: string, organizationId: string) {
    await this.getOwnedSeatLicense(licenseId, organizationId);

    const grouped = await this.prisma.seat.groupBy({
      by: ["status"],
      where: { licenseId },
      _count: { _all: true },
    });

    const counts: Record<SeatStatus, number> = {
      [SeatStatus.AVAILABLE]: 0,
      [SeatStatus.ASSIGNED]: 0,
      [SeatStatus.PENDING]: 0,
      [SeatStatus.INACTIVE]: 0,
    };
    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

    return {
      available: counts[SeatStatus.AVAILABLE],
      assigned: counts[SeatStatus.ASSIGNED],
      pending: counts[SeatStatus.PENDING],
      inactive: counts[SeatStatus.INACTIVE],
      total,
    };
  }

  private async getOwnedSeatLicense(licenseId: string, organizationId: string): Promise<License> {
    const license = await this.prisma.license.findUnique({ where: { id: licenseId } });
    if (!license || license.organizationId !== organizationId) {
      throw new NotFoundException("License not found");
    }
    if (license.type !== LicenseType.SEAT) {
      throw new BadRequestException("Seats can only be managed on a SEAT-type license");
    }
    return license;
  }

  private async getOwnedActiveAssignment(licenseId: string, seatAssignmentId: string) {
    const assignment = await this.prisma.seatAssignment.findUnique({
      where: { id: seatAssignmentId },
      include: { seat: true },
    });
    if (!assignment || assignment.seat.licenseId !== licenseId) {
      throw new NotFoundException("Seat assignment not found");
    }
    if (assignment.status !== SeatAssignmentStatus.ACTIVE) {
      throw new BadRequestException("Seat assignment is not active");
    }
    return assignment;
  }
}
