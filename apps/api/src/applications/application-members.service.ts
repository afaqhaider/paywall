import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ApplicationMemberRole, OrganizationRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { roleAtLeast as orgRoleAtLeast } from "../common/utils/org-role.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { AddApplicationMemberDto } from "./dto/add-application-member.dto";
import type { UpdateApplicationMemberRoleDto } from "./dto/update-application-member-role.dto";

@Injectable()
export class ApplicationMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(applicationId: string) {
    const members = await this.prisma.applicationMember.findMany({
      where: { applicationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return members.map((m) => ({
      membershipId: m.id,
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user,
    }));
  }

  async add(
    applicationId: string,
    dto: AddApplicationMemberDto,
    actingUserId: string,
    meta: RequestMeta,
  ) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException("No account exists for that email yet");
    }

    const existing = await this.prisma.applicationMember.findUnique({
      where: { applicationId_userId: { applicationId, userId: user.id } },
    });
    if (existing) {
      throw new ConflictException("User is already a member of this application");
    }

    await this.assertRoleAssignmentAllowed(applicationId, actingUserId, dto.role);

    const member = await this.prisma.applicationMember.create({
      data: { applicationId, userId: user.id, role: dto.role },
    });

    await this.auditService.record({
      action: "APPLICATION_MEMBER_ADDED",
      userId: actingUserId,
      applicationId,
      metadata: { targetUserId: user.id, role: dto.role },
      ...meta,
    });

    return member;
  }

  async updateRole(
    applicationId: string,
    membershipId: string,
    dto: UpdateApplicationMemberRoleDto,
    actingUserId: string,
    meta: RequestMeta,
  ) {
    const membership = await this.prisma.applicationMember.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.applicationId !== applicationId) {
      throw new NotFoundException("Membership not found");
    }

    await this.assertRoleAssignmentAllowed(applicationId, actingUserId, dto.role);

    if (
      membership.role === ApplicationMemberRole.OWNER &&
      dto.role !== ApplicationMemberRole.OWNER
    ) {
      await this.assertNotLastOwner(applicationId, membershipId);
    }

    const updated = await this.prisma.applicationMember.update({
      where: { id: membershipId },
      data: { role: dto.role },
    });

    await this.auditService.record({
      action: "APPLICATION_MEMBER_ROLE_CHANGED",
      userId: actingUserId,
      applicationId,
      metadata: { targetUserId: membership.userId, from: membership.role, to: dto.role },
      ...meta,
    });

    return updated;
  }

  async remove(
    applicationId: string,
    membershipId: string,
    actingUserId: string,
    meta: RequestMeta,
  ) {
    const membership = await this.prisma.applicationMember.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.applicationId !== applicationId) {
      throw new NotFoundException("Membership not found");
    }

    if (membership.role === ApplicationMemberRole.OWNER) {
      await this.assertNotLastOwner(applicationId, membershipId);
    }

    await this.prisma.applicationMember.delete({ where: { id: membershipId } });

    await this.auditService.record({
      action: "APPLICATION_MEMBER_REMOVED",
      userId: actingUserId,
      applicationId,
      metadata: { targetUserId: membership.userId },
      ...meta,
    });
  }

  /**
   * Only an existing application OWNER - or an OWNER/ADMINISTRATOR of the
   * owning organization (the same override ApplicationRoleGuard grants) -
   * may grant the OWNER role to someone else.
   */
  private async assertRoleAssignmentAllowed(
    applicationId: string,
    actingUserId: string,
    role: ApplicationMemberRole,
  ): Promise<void> {
    if (role !== ApplicationMemberRole.OWNER) {
      return;
    }

    const actingMembership = await this.prisma.applicationMember.findUnique({
      where: { applicationId_userId: { applicationId, userId: actingUserId } },
    });

    if (actingMembership?.role === ApplicationMemberRole.OWNER) {
      return;
    }

    const application = await this.prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      select: { organizationId: true },
    });
    const orgMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: application.organizationId, userId: actingUserId },
      },
    });

    if (!orgMembership || !orgRoleAtLeast(orgMembership.role, OrganizationRole.ADMINISTRATOR)) {
      throw new ForbiddenException(
        "Only an application owner (or the owning organization's owner/administrator) can grant the owner role",
      );
    }
  }

  private async assertNotLastOwner(
    applicationId: string,
    excludingMembershipId: string,
  ): Promise<void> {
    const ownerCount = await this.prisma.applicationMember.count({
      where: {
        applicationId,
        role: ApplicationMemberRole.OWNER,
        id: { not: excludingMembershipId },
      },
    });

    if (ownerCount === 0) {
      throw new BadRequestException("Application must have at least one owner");
    }
  }
}
