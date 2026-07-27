import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import { slugify } from "../common/utils/slug.util";
import type { CreateOrganizationDto } from "./dto/create-organization.dto";
import type { UpdateOrganizationDto } from "./dto/update-organization.dto";
import type { AddMemberDto } from "./dto/add-member.dto";
import type { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto, meta: RequestMeta) {
    const slug = await this.generateUniqueSlug(dto.name);

    const organization = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: dto.name, slug } });
      await tx.organizationMember.create({
        data: { organizationId: org.id, userId, role: OrganizationRole.OWNER },
      });
      return org;
    });

    await this.auditService.record({
      action: "ORGANIZATION_CREATED",
      userId,
      organizationId: organization.id,
      ...meta,
    });

    return organization;
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  async getOne(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { _count: { select: { members: true } } },
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      memberCount: organization._count.members,
      createdAt: organization.createdAt,
    };
  }

  async update(
    organizationId: string,
    dto: UpdateOrganizationDto,
    userId: string,
    meta: RequestMeta,
  ) {
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: dto.name },
    });

    await this.auditService.record({
      action: "ORGANIZATION_UPDATED",
      userId,
      organizationId,
      ...meta,
    });

    return organization;
  }

  async remove(organizationId: string, userId: string, meta: RequestMeta) {
    // Record the audit event before deleting: AuditLog.organizationId is a
    // real foreign key, so inserting a row that references this organization
    // AFTER it's gone would fail the constraint - not merely be nullified.
    await this.auditService.record({
      action: "ORGANIZATION_UPDATED",
      userId,
      organizationId,
      metadata: { action: "deleted" },
      ...meta,
    });
    await this.prisma.organization.delete({ where: { id: organizationId } });
  }

  async listMembers(organizationId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
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

  async addMember(
    organizationId: string,
    dto: AddMemberDto,
    actingUserId: string,
    meta: RequestMeta,
  ) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException("No account exists for that email yet");
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (existing) {
      throw new ConflictException("User is already a member of this organization");
    }

    await this.assertRoleAssignmentAllowed(organizationId, actingUserId, dto.role);

    const member = await this.prisma.organizationMember.create({
      data: { organizationId, userId: user.id, role: dto.role },
    });

    await this.auditService.record({
      action: "ORGANIZATION_ROLE_CHANGED",
      userId: actingUserId,
      organizationId,
      metadata: { action: "added", targetUserId: user.id, role: dto.role },
      ...meta,
    });

    return member;
  }

  async updateMemberRole(
    organizationId: string,
    membershipId: string,
    dto: UpdateMemberRoleDto,
    actingUserId: string,
    meta: RequestMeta,
  ) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.organizationId !== organizationId) {
      throw new NotFoundException("Membership not found");
    }

    await this.assertRoleAssignmentAllowed(organizationId, actingUserId, dto.role);

    if (membership.role === OrganizationRole.OWNER && dto.role !== OrganizationRole.OWNER) {
      await this.assertNotLastOwner(organizationId, membershipId);
    }

    const updated = await this.prisma.organizationMember.update({
      where: { id: membershipId },
      data: { role: dto.role },
    });

    await this.auditService.record({
      action: "ORGANIZATION_ROLE_CHANGED",
      userId: actingUserId,
      organizationId,
      metadata: { targetUserId: membership.userId, from: membership.role, to: dto.role },
      ...meta,
    });

    return updated;
  }

  async removeMember(
    organizationId: string,
    membershipId: string,
    actingUserId: string,
    meta: RequestMeta,
  ) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.organizationId !== organizationId) {
      throw new NotFoundException("Membership not found");
    }

    if (membership.role === OrganizationRole.OWNER) {
      await this.assertNotLastOwner(organizationId, membershipId);
    }

    await this.prisma.organizationMember.delete({ where: { id: membershipId } });

    await this.auditService.record({
      action: "ORGANIZATION_MEMBER_REMOVED",
      userId: actingUserId,
      organizationId,
      metadata: { targetUserId: membership.userId },
      ...meta,
    });
  }

  /** Only an OWNER may grant the OWNER role to someone else. */
  private async assertRoleAssignmentAllowed(
    organizationId: string,
    actingUserId: string,
    role: OrganizationRole,
  ): Promise<void> {
    if (role !== OrganizationRole.OWNER) {
      return;
    }

    const actingMembership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: actingUserId } },
    });

    if (actingMembership?.role !== OrganizationRole.OWNER) {
      throw new ForbiddenException("Only an owner can grant the owner role");
    }
  }

  private async assertNotLastOwner(
    organizationId: string,
    excludingMembershipId: string,
  ): Promise<void> {
    const ownerCount = await this.prisma.organizationMember.count({
      where: { organizationId, role: OrganizationRole.OWNER, id: { not: excludingMembershipId } },
    });

    if (ownerCount === 0) {
      throw new BadRequestException("Organization must have at least one owner");
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || "org";
    let candidate = base;
    let suffix = 1;

    while (await this.prisma.organization.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }
}
