import { Injectable, NotFoundException } from "@nestjs/common";
import type { Subscription } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import type { MutationOptionsDto } from "../subscriptions/dto/mutation-options.dto";
import type { CreateSubscriptionChangeDto } from "../subscriptions/dto/create-subscription-change.dto";
import type { RequestMeta } from "../common/utils/request-meta.util";
import { CustomerOwnershipService } from "./customer-ownership.service";
import type { CancelSubscriptionRequestDto } from "./dto/cancel-subscription-request.dto";

/**
 * Thin self-service wrapper around `SubscriptionsService` (Phase 4): every
 * method here re-verifies (a) the caller owns the `Customer` and (b) the
 * subscription actually belongs to that customer, then delegates the actual
 * lifecycle transition to the existing service rather than reimplementing
 * it. One shared `AuditAction` (`SUBSCRIPTION_SELF_SERVICE_ACTION`) covers
 * every action here, differentiated by `metadata.action` - the schema is
 * frozen for this phase and no per-action enum values were added.
 */
@Injectable()
export class CustomerSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ownership: CustomerOwnershipService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async list(customerId: string, userId: string) {
    await this.ownership.loadOwnedCustomer(customerId, userId);
    return this.prisma.subscription.findMany({
      where: { customerId },
      include: { items: { include: { price: true } }, plan: true, product: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(customerId: string, subscriptionId: string, userId: string) {
    await this.ownership.loadOwnedCustomer(customerId, userId);
    const subscription = await this.getOwnedSubscription(customerId, subscriptionId);
    return this.prisma.subscription.findUnique({
      where: { id: subscription.id },
      include: { items: { include: { price: true } }, plan: true, product: true },
    });
  }

  async cancel(
    customerId: string,
    subscriptionId: string,
    userId: string,
    dto: CancelSubscriptionRequestDto,
    meta: RequestMeta,
  ) {
    const subscription = await this.assertOwnedSubscription(customerId, subscriptionId, userId);
    const result = await this.subscriptionsService.cancel(
      subscriptionId,
      userId,
      { atPeriodEnd: !dto.immediate, reason: dto.reason },
      meta,
    );
    await this.recordSelfServiceAudit(subscription, userId, "cancel", meta);
    return result;
  }

  async renew(
    customerId: string,
    subscriptionId: string,
    userId: string,
    options: MutationOptionsDto,
    meta: RequestMeta,
  ) {
    const subscription = await this.assertOwnedSubscription(customerId, subscriptionId, userId);
    const result = await this.subscriptionsService.renew(subscriptionId, userId, options, meta);
    await this.recordSelfServiceAudit(subscription, userId, "renew", meta);
    return result;
  }

  async pause(
    customerId: string,
    subscriptionId: string,
    userId: string,
    options: MutationOptionsDto,
    meta: RequestMeta,
  ) {
    const subscription = await this.assertOwnedSubscription(customerId, subscriptionId, userId);
    const result = await this.subscriptionsService.pause(subscriptionId, userId, options, meta);
    await this.recordSelfServiceAudit(subscription, userId, "pause", meta);
    return result;
  }

  async resume(
    customerId: string,
    subscriptionId: string,
    userId: string,
    options: MutationOptionsDto,
    meta: RequestMeta,
  ) {
    const subscription = await this.assertOwnedSubscription(customerId, subscriptionId, userId);
    const result = await this.subscriptionsService.resume(subscriptionId, userId, options, meta);
    await this.recordSelfServiceAudit(subscription, userId, "resume", meta);
    return result;
  }

  /** Covers upgrade/downgrade/billing-cycle-change/seat-change - all just different `type` values on `SubscriptionChangeType`. */
  async applyChange(
    customerId: string,
    subscriptionId: string,
    userId: string,
    dto: CreateSubscriptionChangeDto,
    meta: RequestMeta,
  ) {
    const subscription = await this.assertOwnedSubscription(customerId, subscriptionId, userId);
    const result = await this.subscriptionsService.applyChange(subscriptionId, userId, dto, meta);
    await this.recordSelfServiceAudit(subscription, userId, "change", meta, { type: dto.type });
    return result;
  }

  async listChanges(customerId: string, subscriptionId: string, userId: string) {
    await this.assertOwnedSubscription(customerId, subscriptionId, userId);
    return this.subscriptionsService.listChanges(subscriptionId);
  }

  private async assertOwnedSubscription(
    customerId: string,
    subscriptionId: string,
    userId: string,
  ): Promise<Subscription> {
    await this.ownership.loadOwnedCustomer(customerId, userId);
    return this.getOwnedSubscription(customerId, subscriptionId);
  }

  private async getOwnedSubscription(
    customerId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription || subscription.customerId !== customerId) {
      throw new NotFoundException("Subscription not found");
    }
    return subscription;
  }

  private async recordSelfServiceAudit(
    subscription: Subscription,
    userId: string,
    action: string,
    meta: RequestMeta,
    extraMetadata: Record<string, unknown> = {},
  ) {
    await this.auditService.record({
      action: "SUBSCRIPTION_SELF_SERVICE_ACTION",
      userId,
      organizationId: subscription.organizationId,
      applicationId: subscription.applicationId,
      metadata: { subscriptionId: subscription.id, action, ...extraMetadata },
      ...meta,
    });
  }
}
