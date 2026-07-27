import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { OrganizationRole } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { roleAtLeast } from "../utils/org-role.util";
import { ORG_ROLE_KEY } from "../decorators/require-org-role.decorator";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";

@Injectable()
export class OrganizationRoleGuard implements CanActivate {
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
    const organizationId = request.params.organizationId as string | undefined;
    const user = request.user;

    if (!organizationId || !user) {
      throw new ForbiddenException("Organization membership required");
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });

    if (!membership || !roleAtLeast(membership.role, requiredRole)) {
      throw new ForbiddenException("Insufficient organization role");
    }

    (request as Request & { orgMembership?: typeof membership }).orgMembership = membership;

    return true;
  }
}
