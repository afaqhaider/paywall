import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { SubscriptionsService } from "./subscriptions.service";
import { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import { CreateSubscriptionChangeDto } from "./dto/create-subscription-change.dto";
import { CancelSubscriptionDto } from "./dto/cancel-subscription.dto";
import { SuspendSubscriptionDto } from "./dto/suspend-subscription.dto";
import { GracePeriodDto } from "./dto/grace-period.dto";
import { MutationOptionsDto } from "./dto/mutation-options.dto";
import { RedeemCouponDto } from "../coupons/dto/redeem-coupon.dto";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";
import { OrgScopedGuard } from "../common/guards/org-scoped.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post()
  async create(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubscriptionDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.create(organizationId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(@Param("organizationId") organizationId: string, @Query() query: CursorQueryDto) {
    return this.subscriptionsService.list(organizationId, query);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get(":subscriptionId")
  async getOne(
    @Param("subscriptionId") subscriptionId: string,
    @Param("organizationId") organizationId: string,
  ) {
    return this.subscriptionsService.getOne(subscriptionId, organizationId);
  }
}

const resolveSubscriptionOrg = async (prisma: PrismaService, subscriptionId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { organizationId: true },
  });
  return subscription?.organizationId ?? null;
};

@UseGuards(OrgScopedGuard("subscriptionId", resolveSubscriptionOrg))
@Controller("subscriptions/:subscriptionId")
export class SubscriptionLifecycleController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get("events")
  async listEvents(
    @Param("subscriptionId") subscriptionId: string,
    @Query() query: CursorQueryDto,
  ) {
    return this.subscriptionsService.listEvents(subscriptionId, query);
  }

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get("changes")
  async listChanges(@Param("subscriptionId") subscriptionId: string) {
    return this.subscriptionsService.listChanges(subscriptionId);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("changes")
  async createChange(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubscriptionChangeDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.applyChange(
      subscriptionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("changes/:changeId/cancel")
  async cancelChange(
    @Param("subscriptionId") subscriptionId: string,
    @Param("changeId") changeId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.cancelScheduledChange(
      subscriptionId,
      changeId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("activate")
  async activate(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.activate(
      subscriptionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("renew")
  async renew(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.renew(subscriptionId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("cancel")
  async cancel(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelSubscriptionDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.cancel(subscriptionId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("resume")
  async resume(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.resume(subscriptionId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("pause")
  async pause(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.pause(subscriptionId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("mark-past-due")
  async markPastDue(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.markPastDue(
      subscriptionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("enter-grace-period")
  async enterGracePeriod(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GracePeriodDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.enterGracePeriod(
      subscriptionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("expire")
  async expire(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.expire(subscriptionId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("suspend")
  async suspend(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SuspendSubscriptionDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.suspend(subscriptionId, user.id, dto, extractRequestMeta(req));
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("reactivate")
  async reactivate(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.reactivate(
      subscriptionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("coupons")
  async applyCoupon(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RedeemCouponDto,
  ) {
    return this.subscriptionsService.applyCoupon(subscriptionId, user.id, dto);
  }

  @RequireOrgRole(OrganizationRole.ADMINISTRATOR)
  @Post("coupons/:subscriptionCouponId/remove")
  async removeCoupon(
    @Param("subscriptionId") subscriptionId: string,
    @Param("subscriptionCouponId") subscriptionCouponId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.removeCoupon(subscriptionId, subscriptionCouponId, user.id);
  }
}
