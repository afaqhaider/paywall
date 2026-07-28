import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  mixin,
  type CanActivate,
  type ExecutionContext,
  type Type,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrganizationRole, type ApplicationMemberRole } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { roleAtLeast as appRoleAtLeast } from "../utils/app-role.util";
import { roleAtLeast as orgRoleAtLeast } from "../utils/org-role.util";
import { APP_ROLE_KEY } from "../decorators/require-app-role.decorator";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";
import type { ApplicationContext } from "./application-role.guard";

/**
 * Factory for an app-role guard scoped to a resource that isn't itself
 * under `/applications/:applicationId/...` (e.g. a flattened
 * `/oauth-applications/:oauthApplicationId/credentials` or
 * `/webhook-endpoints/:webhookEndpointId/deliveries` route) - the same
 * flattened-route problem `OrgScopedGuard` solves for org-scoped
 * resources, mirrored here for application-scoped ones.
 *
 * `resolveApplicationId` walks whatever relations are needed to find the
 * owning application; the guard 404s if that chain doesn't resolve, and
 * otherwise applies the exact same rule as `ApplicationRoleGuard`: an
 * OWNER/ADMINISTRATOR of the owning organization always has override
 * access, everyone else needs a matching (or higher) ApplicationMember role.
 */
export function ApplicationScopedGuard(
  paramName: string,
  resolveApplicationId: (prisma: PrismaService, resourceId: string) => Promise<string | null>,
): Type<CanActivate> {
  @Injectable()
  class MixinApplicationScopedGuard implements CanActivate {
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
      const rawResourceId = request.params[paramName];
      const resourceId = Array.isArray(rawResourceId) ? rawResourceId[0] : rawResourceId;
      const user = request.user;

      if (!resourceId || !user) {
        throw new ForbiddenException("Application membership required");
      }

      const applicationId = await resolveApplicationId(this.prisma, resourceId);
      if (!applicationId) {
        throw new NotFoundException("Resource not found");
      }

      const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        select: { id: true, organizationId: true },
      });
      if (!application) {
        throw new NotFoundException("Resource not found");
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

  return mixin(MixinApplicationScopedGuard);
}
