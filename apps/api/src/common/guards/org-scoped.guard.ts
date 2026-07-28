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
import type { OrganizationRole } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { roleAtLeast } from "../utils/org-role.util";
import { ORG_ROLE_KEY } from "../decorators/require-org-role.decorator";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";

/**
 * Factory for an org-role guard scoped to a resource that isn't itself
 * under `/organizations/:organizationId/...` (e.g. a flattened
 * `/plans/:planId/prices` route). `resolveOrganizationId` walks whatever
 * relations are needed to find the owning organization; the guard 404s if
 * the resource (or its chain up to an organization) doesn't exist, and
 * 403s if the caller's role there doesn't meet `@RequireOrgRole(...)`.
 *
 * This is the same mixin pattern Nest's own dynamic pipes/guards use -
 * it avoids hand-writing a near-identical guard class per resource type.
 */
export function OrgScopedGuard(
  paramName: string,
  resolveOrganizationId: (prisma: PrismaService, resourceId: string) => Promise<string | null>,
): Type<CanActivate> {
  @Injectable()
  class MixinOrgScopedGuard implements CanActivate {
    constructor(
      private readonly reflector: Reflector,
      private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
      const requiredRole = this.reflector.getAllAndOverride<OrganizationRole | undefined>(
        ORG_ROLE_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (!requiredRole) {
        return true;
      }

      const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
      const rawResourceId = request.params[paramName];
      const resourceId = Array.isArray(rawResourceId) ? rawResourceId[0] : rawResourceId;
      const user = request.user;

      if (!resourceId || !user) {
        throw new ForbiddenException("Organization membership required");
      }

      const organizationId = await resolveOrganizationId(this.prisma, resourceId);
      if (!organizationId) {
        throw new NotFoundException("Resource not found");
      }

      const membership = await this.prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: user.id } },
      });

      if (!membership || !roleAtLeast(membership.role, requiredRole)) {
        throw new ForbiddenException("Insufficient organization role");
      }

      return true;
    }
  }

  return mixin(MixinOrgScopedGuard);
}
