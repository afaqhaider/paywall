import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ApplicationMemberRole, DeveloperInvitationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { secrets } from "../config/secrets";
import { generateOpaqueToken, hashOpaqueToken } from "../common/utils/token.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import type { CreateInvitationDto } from "./dto/create-invitation.dto";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
  ) {}

  async create(applicationId: string, dto: CreateInvitationDto, userId: string, meta: RequestMeta) {
    const role = dto.role ?? ApplicationMemberRole.DEVELOPER;
    if (role === ApplicationMemberRole.OWNER) {
      throw new BadRequestException(
        "Cannot invite as OWNER; ownership transfer is a separate operation",
      );
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, name: true },
    });
    if (!application) {
      throw new NotFoundException("Application not found");
    }

    const existingMember = await this.prisma.applicationMember.findFirst({
      where: { applicationId, user: { email: { equals: dto.email, mode: "insensitive" } } },
    });
    if (existingMember) {
      throw new ConflictException("This email is already a member of the application");
    }

    // An existing PENDING invitation for the same application+email is
    // revoked and replaced rather than blocking the caller from re-inviting.
    const existingPending = await this.prisma.developerInvitation.findFirst({
      where: { applicationId, email: dto.email, status: DeveloperInvitationStatus.PENDING },
    });
    if (existingPending) {
      await this.prisma.developerInvitation.update({
        where: { id: existingPending.id },
        data: { status: DeveloperInvitationStatus.REVOKED, revokedAt: new Date() },
      });
    }

    const { token, tokenHash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const invitation = await this.prisma.developerInvitation.create({
      data: {
        applicationId,
        email: dto.email,
        role,
        tokenHash,
        expiresAt,
        invitedById: userId,
      },
    });

    const acceptUrl = this.buildAcceptUrl(token);
    await this.mailService.sendDeveloperInvitationEmail(dto.email, application.name, acceptUrl);

    await this.auditService.record({
      action: "DEVELOPER_INVITATION_CREATED",
      userId,
      applicationId,
      metadata: { invitationId: invitation.id, email: invitation.email, role: invitation.role },
      ...meta,
    });

    const { tokenHash: _tokenHash, ...safeInvitation } = invitation;
    return { ...safeInvitation, token, acceptUrl };
  }

  async list(applicationId: string) {
    return this.prisma.developerInvitation.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
      select: this.safeSelect(),
    });
  }

  async revoke(applicationId: string, invitationId: string, userId: string, meta: RequestMeta) {
    const invitation = await this.getOwnedInvitation(applicationId, invitationId);
    if (invitation.status !== DeveloperInvitationStatus.PENDING) {
      throw new BadRequestException("Only a pending invitation can be revoked");
    }

    await this.prisma.developerInvitation.update({
      where: { id: invitationId },
      data: { status: DeveloperInvitationStatus.REVOKED, revokedAt: new Date() },
    });

    await this.auditService.record({
      action: "DEVELOPER_INVITATION_REVOKED",
      userId,
      applicationId,
      metadata: { invitationId },
      ...meta,
    });
  }

  async resend(applicationId: string, invitationId: string, userId: string, meta: RequestMeta) {
    const invitation = await this.getOwnedInvitation(applicationId, invitationId);
    if (invitation.status !== DeveloperInvitationStatus.PENDING) {
      throw new BadRequestException("Only a pending invitation can be resent");
    }

    const application = await this.prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      select: { name: true },
    });

    const { token, tokenHash } = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const updated = await this.prisma.developerInvitation.update({
      where: { id: invitationId },
      data: { tokenHash, expiresAt },
    });

    const acceptUrl = this.buildAcceptUrl(token);
    await this.mailService.sendDeveloperInvitationEmail(updated.email, application.name, acceptUrl);

    await this.auditService.record({
      action: "DEVELOPER_INVITATION_RESENT",
      userId,
      applicationId,
      metadata: { invitationId },
      ...meta,
    });

    const { tokenHash: _tokenHash, ...safeInvitation } = updated;
    return { ...safeInvitation, token, acceptUrl };
  }

  async accept(token: string, user: AuthenticatedUser, meta: RequestMeta) {
    const tokenHash = hashOpaqueToken(token);
    const invitation = await this.prisma.developerInvitation.findUnique({ where: { tokenHash } });
    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    if (invitation.status !== DeveloperInvitationStatus.PENDING) {
      throw new BadRequestException("Invitation is no longer pending");
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.developerInvitation.update({
        where: { id: invitation.id },
        data: { status: DeveloperInvitationStatus.EXPIRED },
      });
      throw new BadRequestException("Invitation has expired");
    }

    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenException("This invitation was sent to a different email address");
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const existingMember = await tx.applicationMember.findUnique({
        where: {
          applicationId_userId: { applicationId: invitation.applicationId, userId: user.id },
        },
      });

      const applicationMember =
        existingMember ??
        (await tx.applicationMember.create({
          data: {
            applicationId: invitation.applicationId,
            userId: user.id,
            role: invitation.role,
          },
        }));

      await tx.developerInvitation.update({
        where: { id: invitation.id },
        data: {
          status: DeveloperInvitationStatus.ACCEPTED,
          acceptedById: user.id,
          acceptedAt: new Date(),
        },
      });

      return applicationMember;
    });

    await this.auditService.record({
      action: "DEVELOPER_INVITATION_ACCEPTED",
      userId: user.id,
      applicationId: invitation.applicationId,
      metadata: { invitationId: invitation.id },
      ...meta,
    });

    return member;
  }

  private buildAcceptUrl(token: string): string {
    return `${secrets.webOrigin}/invitations/accept?token=${token}`;
  }

  private safeSelect() {
    return {
      id: true,
      applicationId: true,
      email: true,
      role: true,
      status: true,
      invitedById: true,
      acceptedById: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true,
    } as const;
  }

  private async getOwnedInvitation(applicationId: string, invitationId: string) {
    const invitation = await this.prisma.developerInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.applicationId !== applicationId) {
      throw new NotFoundException("Invitation not found");
    }
    return invitation;
  }
}
