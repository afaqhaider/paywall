import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { CustomerSubscriptionsService } from "./customer-subscriptions.service";
import { CancelSubscriptionRequestDto } from "./dto/cancel-subscription-request.dto";
import { MutationOptionsDto } from "../subscriptions/dto/mutation-options.dto";
import { CreateSubscriptionChangeDto } from "../subscriptions/dto/create-subscription-change.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@Controller("customer-portal/customers/:customerId/subscriptions")
export class CustomerSubscriptionsController {
  constructor(private readonly subscriptionsService: CustomerSubscriptionsService) {}

  @Get()
  async list(@Param("customerId") customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.subscriptionsService.list(customerId, user.id);
  }

  @Get(":subscriptionId")
  async getOne(
    @Param("customerId") customerId: string,
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.getOne(customerId, subscriptionId, user.id);
  }

  @Post(":subscriptionId/cancel")
  async cancel(
    @Param("customerId") customerId: string,
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelSubscriptionRequestDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.cancel(
      customerId,
      subscriptionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Post(":subscriptionId/renew")
  async renew(
    @Param("customerId") customerId: string,
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.renew(
      customerId,
      subscriptionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Post(":subscriptionId/pause")
  async pause(
    @Param("customerId") customerId: string,
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.pause(
      customerId,
      subscriptionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Post(":subscriptionId/resume")
  async resume(
    @Param("customerId") customerId: string,
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MutationOptionsDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.resume(
      customerId,
      subscriptionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  /** Covers upgrade / downgrade / billing-cycle change / seat management - all driven by `CreateSubscriptionChangeDto.type`. */
  @Post(":subscriptionId/change")
  async applyChange(
    @Param("customerId") customerId: string,
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubscriptionChangeDto,
    @Req() req: Request,
  ) {
    return this.subscriptionsService.applyChange(
      customerId,
      subscriptionId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @Get(":subscriptionId/changes")
  async listChanges(
    @Param("customerId") customerId: string,
    @Param("subscriptionId") subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.listChanges(customerId, subscriptionId, user.id);
  }
}
