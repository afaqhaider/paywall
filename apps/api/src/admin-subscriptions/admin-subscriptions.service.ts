import { Injectable, NotFoundException } from "@nestjs/common";
import { SubscriptionProvider, type Subscription } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CancelSubscriptionDto } from "../subscriptions/dto/cancel-subscription.dto";
import type { MutationOptionsDto } from "../subscriptions/dto/mutation-options.dto";
import type { CreateSubscriptionChangeDto } from "../subscriptions/dto/create-subscription-change.dto";
import type { GrantComplimentaryDto } from "./dto/grant-complimentary.dto";
import type { ExtendTrialDto } from "./dto/extend-trial.dto";
import type { AdjustRenewalDateDto } from "./dto/adjust-renewal-date.dto";

/**
 * Thin platform-admin wrappers around `SubscriptionsService`'s existing
 * lifecycle methods (the admin acts as the `userId` in the underlying
 * audit/event trail, exactly like a self-service call would), plus two admin
 * -only capabilities that don't exist anywhere else: granting a
 * complimentary subscription and directly overriding trial-end /
 * current-period-end dates. Every mutation here additionally records its own
 * `SUBSCRIPTION_ADMIN_ACTION` audit entry (differentiated by
 * `metadata.action`) so "an admin did this" is distinguishable from the
 * normal self-service audit trail the wrapped methods already write.
 */
@Injectable()
export class AdminSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Creates a new subscription directly, bypassing payment entirely.
   * `SubscriptionsService.create()` already supports exactly this shape -
   * `provider` defaults to MANUAL and `status` defaults to ACTIVE (unless
   * trialing) - so this reuses it as-is rather than writing a parallel
   * `prisma.subscription.create()`. The only genuinely new behavior is
   * `durationDays`: a complimentary grant doesn't have to follow the plan's
   * normal billing interval, so when set, this does one small raw
   * `prisma.subscription.update()` afterward to override
   * `currentPeriodEnd` - a deliberate, documented admin-only override, not
   * a lifecycle transition, so it lives here rather than in
   * `SubscriptionsService`.
   */
  async grantComplimentary(
    adminUserId: string,
    dto: GrantComplimentaryDto,
    meta: RequestMeta,
  ): Promise<Subscription> {
    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: dto.planId },
      include: { product: true },
    });

    let subscription = await this.subscriptionsService.create(
      plan.product.organizationId,
      adminUserId,
      {
        customerId: dto.customerId,
        productId: plan.productId,
        planId: dto.planId,
        priceId: dto.priceId,
        quantity: dto.quantity,
        provider: SubscriptionProvider.MANUAL,
      },
      meta,
    );

    if (dto.durationDays) {
      const periodEnd = addDays(new Date(), dto.durationDays);
      subscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { currentPeriodEnd: periodEnd, version: { increment: 1 } },
      });
    }

    await this.recordAdminAction(adminUserId, subscription, meta, {
      action: "grant_complimentary",
      customerId: dto.customerId,
      planId: dto.planId,
      priceId: dto.priceId,
      durationDays: dto.durationDays,
    });

    return subscription;
  }

  async cancel(
    subscriptionId: string,
    adminUserId: string,
    dto: CancelSubscriptionDto,
    meta: RequestMeta,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionsService.cancel(
      subscriptionId,
      adminUserId,
      dto,
      meta,
    );
    await this.recordAdminAction(adminUserId, subscription, meta, { action: "cancel" });
    return subscription;
  }

  async pause(
    subscriptionId: string,
    adminUserId: string,
    dto: MutationOptionsDto,
    meta: RequestMeta,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionsService.pause(
      subscriptionId,
      adminUserId,
      dto,
      meta,
    );
    await this.recordAdminAction(adminUserId, subscription, meta, { action: "pause" });
    return subscription;
  }

  async resume(
    subscriptionId: string,
    adminUserId: string,
    dto: MutationOptionsDto,
    meta: RequestMeta,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionsService.resume(
      subscriptionId,
      adminUserId,
      dto,
      meta,
    );
    await this.recordAdminAction(adminUserId, subscription, meta, { action: "resume" });
    return subscription;
  }

  /** Manual renewal. `SubscriptionsService.renew()` already covers this - it's
   * the same operation the periodic renewal path would run, just triggered
   * by an admin instead of a scheduler/webhook. */
  async renew(
    subscriptionId: string,
    adminUserId: string,
    dto: MutationOptionsDto,
    meta: RequestMeta,
  ): Promise<Subscription> {
    const subscription = await this.subscriptionsService.renew(
      subscriptionId,
      adminUserId,
      dto,
      meta,
    );
    await this.recordAdminAction(adminUserId, subscription, meta, { action: "renew" });
    return subscription;
  }

  async extendTrial(
    subscriptionId: string,
    adminUserId: string,
    dto: ExtendTrialDto,
    meta: RequestMeta,
  ): Promise<Subscription> {
    const newTrialEnd = new Date(dto.newTrialEnd);
    const subscription = await this.subscriptionsService.extendTrial(
      subscriptionId,
      adminUserId,
      newTrialEnd,
      meta,
    );
    await this.recordAdminAction(adminUserId, subscription, meta, {
      action: "extend_trial",
      newTrialEnd: newTrialEnd.toISOString(),
    });
    return subscription;
  }

  /**
   * Directly overrides `currentPeriodEnd`. No lifecycle method sets this in
   * isolation (`renew()` always recomputes it from the price's billing
   * interval) - this is a deliberate raw admin override rather than a
   * lifecycle transition (no status change, no `SubscriptionEvent`), so it
   * lives in this admin-only service via a direct `prisma.subscription.
   * update()` rather than as a new method on `SubscriptionsService`.
   */
  async adjustRenewalDate(
    subscriptionId: string,
    adminUserId: string,
    dto: AdjustRenewalDateDto,
    meta: RequestMeta,
  ): Promise<Subscription> {
    const existing = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!existing) {
      throw new NotFoundException("Subscription not found");
    }

    const currentPeriodEnd = new Date(dto.currentPeriodEnd);
    const subscription = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { currentPeriodEnd, version: { increment: 1 } },
    });

    await this.recordAdminAction(adminUserId, subscription, meta, {
      action: "adjust_renewal_date",
      currentPeriodEnd: currentPeriodEnd.toISOString(),
    });

    return subscription;
  }

  async changePlan(
    subscriptionId: string,
    adminUserId: string,
    dto: CreateSubscriptionChangeDto,
    meta: RequestMeta,
  ) {
    const result = await this.subscriptionsService.applyChange(
      subscriptionId,
      adminUserId,
      dto,
      meta,
    );

    const subscription = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: subscriptionId },
    });
    await this.recordAdminAction(adminUserId, subscription, meta, {
      action: "change_plan",
      changeType: dto.type,
      immediate: Boolean(dto.immediate),
    });

    return result;
  }

  private async recordAdminAction(
    adminUserId: string,
    subscription: Subscription,
    meta: RequestMeta,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      action: "SUBSCRIPTION_ADMIN_ACTION",
      userId: adminUserId,
      organizationId: subscription.organizationId,
      applicationId: subscription.applicationId,
      metadata: { subscriptionId: subscription.id, ...metadata },
      ...meta,
    });
  }
}

function addDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}
