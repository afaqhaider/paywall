import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AdminSubscriptionsService } from "./admin-subscriptions.service";
import { GrantComplimentaryDto } from "./dto/grant-complimentary.dto";
import { ExtendTrialDto } from "./dto/extend-trial.dto";
import { AdjustRenewalDateDto } from "./dto/adjust-renewal-date.dto";
import { CancelSubscriptionDto } from "../subscriptions/dto/cancel-subscription.dto";
import { MutationOptionsDto } from "../subscriptions/dto/mutation-options.dto";
import { CreateSubscriptionChangeDto } from "../subscriptions/dto/create-subscription-change.dto";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

/**
 * Platform-admin subscription operations. Mounted at `admin/subscriptions`
 * rather than literally `admin/subscriptions/:subscriptionId/*` as written
 * in the brief - `grant-complimentary` creates a brand new subscription and
 * has no `:subscriptionId` to hang off of, so it lives at the controller
 * root and every other route carries `:subscriptionId` as its own first
 * path segment instead.
 */
@UseGuards(PlatformAdminGuard)
@Controller("admin/subscriptions")
export class AdminSubscriptionsController {
  constructor(private readonly adminSubscriptionsService: AdminSubscriptionsService) {}

  @Post("grant-complimentary")
  async grantComplimentary(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: GrantComplimentaryDto,
    @Req() req: Request,
  ) {
    return this.adminSubscriptionsService.grantComplimentary(
      admin.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Post(":subscriptionId/cancel")
  async cancel(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CancelSubscriptionDto,
    @Req() req: Request,
  ) {
    return this.adminSubscriptionsService.cancel(
      subscriptionId,
      admin.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Post(":subscriptionId/pause")
  async pause(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.adminSubscriptionsService.pause(
      subscriptionId,
      admin.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Post(":subscriptionId/resume")
  async resume(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.adminSubscriptionsService.resume(
      subscriptionId,
      admin.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Post(":subscriptionId/renew")
  async renew(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.adminSubscriptionsService.renew(
      subscriptionId,
      admin.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Post(":subscriptionId/extend-trial")
  async extendTrial(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ExtendTrialDto,
    @Req() req: Request,
  ) {
    return this.adminSubscriptionsService.extendTrial(
      subscriptionId,
      admin.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Post(":subscriptionId/adjust-renewal-date")
  async adjustRenewalDate(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: AdjustRenewalDateDto,
    @Req() req: Request,
  ) {
    return this.adminSubscriptionsService.adjustRenewalDate(
      subscriptionId,
      admin.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Post(":subscriptionId/change-plan")
  async changePlan(
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateSubscriptionChangeDto,
    @Req() req: Request,
  ) {
    return this.adminSubscriptionsService.changePlan(
      subscriptionId,
      admin.id,
      dto,
      extractRequestMeta(req),
    );
  }
}
