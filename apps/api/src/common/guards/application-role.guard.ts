import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrganizationRole, type ApplicationMemberRole } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { roleAtLeast as appRoleAtLeast } from "../utils/app-role.util";
import { roleAtLeast as orgRoleAtLeast } from "../utils/org-role.util";
import { APP_ROLE_KEY } from "../decorators/require-app-role.decorator";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";

export interface ApplicationContext {
  id: string;
  organizationId: string;
}

/**
 * Enforces per-application roles for routes carrying an `:applicationId`
 * route param, decorated with `@RequireAppRole(...)`.
 *
 * An OWNER/ADMINISTRATOR of the application's owning organization always
 * has override access, even without an explicit ApplicationMember row -
 * everyone else needs a matching (or higher) ApplicationMember role.
 *
 * If the route also carries an `:organizationId` param, it must match the
 * application's real owning organization, or the request 404s as if the
 * application doesn't exist - this is the concrete organization-isolation
 * guarantee: an application can never be reached through the wrong org's URL.
 */
@Injectable()
export class ApplicationRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<ApplicationMemberRole | undefined>(
      APP_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRole) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser; application?: ApplicationContext }>();
    const applicationId = request.params.applicationId as string | undefined;
    const organizationIdParam = request.params.organizationId as string | undefined;
    const user = request.user;

    if (!applicationId || !user) {
      throw new ForbiddenException("Application membership required");
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, organizationId: true },
    });

    if (!application) {
      throw new NotFoundException("Application not found");
    }

    if (organizationIdParam && organizationIdParam !== application.organizationId) {
      throw new NotFoundException("Application not found");
    }

    const orgMembership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: application.organizationId, userId: user.id },
      },
    });

    if (orgMembership && orgRoleAtLeast(orgMembership.role, OrganizationRole.ADMINISTRATOR)) {
      request.application = application;
      return true;
    }

    const appMembership = await this.prisma.applicationMember.findUnique({
      where: { applicationId_userId: { applicationId, userId: user.id } },
    });

    if (!appMembership || !appRoleAtLeast(appMembership.role, requiredRole)) {
      throw new ForbiddenException("Insufficient application role");
    }

    request.application = application;

    return true;
  }
}
