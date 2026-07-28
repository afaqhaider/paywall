import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { EntitlementGrantsService } from "./entitlement-grants.service";
import { RuntimeAuthorizationService } from "./runtime-authorization.service";
import { CreateEntitlementGrantDto } from "./dto/create-entitlement-grant.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { OrgScopedGuard } from "../common/guards/org-scoped.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/entitlement-grants")
export class EntitlementGrantsController {
  constructor(private readonly grantsService: EntitlementGrantsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEntitlementGrantDto,
    @Req() req: Request,
  ) {
    return this.grantsService.create(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(
    @Param("organizationId") organizationId: string,
    @Query("applicationId") applicationId?: string,
  ) {
    return this.grantsService.list(organizationId, applicationId);
  }
}

@UseGuards(
  OrgScopedGuard("grantId", (p: PrismaService, id: string) =>
    p.entitlementGrant.findUnique({ where: { id } }).then((r) => r?.organizationId ?? null),
  ),
)
@Controller("entitlement-grants/:grantId")
export class EntitlementGrantController {
  constructor(
    private readonly grantsService: EntitlementGrantsService,
    private readonly prisma: PrismaService,
  ) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Delete()
  async revoke(
    @Param("grantId") grantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const grant = await this.prisma.entitlementGrant.findUniqueOrThrow({ where: { id: grantId } });
    await this.grantsService.revoke(
      grantId,
      grant.organizationId,
      user.id,
      extractRequestMeta(req),
    );
  }
}

@UseGuards(
  OrgScopedGuard("subscriptionId", (p: PrismaService, id: string) =>
    p.subscription.findUnique({ where: { id } }).then((r) => r?.organizationId ?? null),
  ),
)
@Controller("subscriptions/:subscriptionId/sync-entitlements")
export class SubscriptionEntitlementSyncController {
  constructor(private readonly grantsService: EntitlementGrantsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async sync(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.grantsService.syncFromSubscription(
      subscriptionId,
      user.id,
      extractRequestMeta(req),
    );
  }
}

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/applications/:applicationId/entitlements")
export class EntitlementRuntimeController {
  constructor(private readonly runtimeAuth: RuntimeAuthorizationService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":key/check")
  async check(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
    @Param("key") key: string,
  ) {
    return this.runtimeAuth.hasEntitlement(organizationId, applicationId, key);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":key/usage")
  async usage(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
    @Param("key") key: string,
  ) {
    return this.runtimeAuth.getUsage(organizationId, applicationId, key);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post(":key/usage/increment")
  async increment(
    @Param("organizationId") organizationId: string,
    @Param("applicationId") applicationId: string,
    @Param("key") key: string,
    @Body("amount") amount?: number,
  ) {
    return this.runtimeAuth.incrementUsage(organizationId, applicationId, key, amount ?? 1);
  }
}
