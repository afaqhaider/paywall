import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  Prisma,
  Subscription,
  SubscriptionStatus,
  SubscriptionEventType,
} from "@prisma/client";
import {
  ApplicationEnvironmentType,
  SubscriptionChangeStatus,
  SubscriptionChangeType,
  SubscriptionProvider,
  TrialStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  buildCursorWhereClause,
  CURSOR_ORDER_BY,
  normalizePageSize,
  paginateResults,
} from "../common/utils/cursor-pagination.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { assertTransition } from "./subscription-state-machine";
import { calculateProration } from "./proration.util";
import { addBillingInterval } from "./billing-interval.util";
import type { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import type { CreateSubscriptionChangeDto } from "./dto/create-subscription-change.dto";
import type { CancelSubscriptionDto } from "./dto/cancel-subscription.dto";
import type { SuspendSubscriptionDto } from "./dto/suspend-subscription.dto";
import type { GracePeriodDto } from "./dto/grace-period.dto";
import type { MutationOptionsDto } from "./dto/mutation-options.dto";
import type { RedeemCouponDto } from "../coupons/dto/redeem-coupon.dto";
import { CouponsService } from "../coupons/coupons.service";
import { FinancialEventsService } from "../financial-events/financial-events.service";

type Tx = Prisma.TransactionClient;

interface TransitionResult {
  toStatus: SubscriptionStatus;
  eventType: SubscriptionEventType;
  data?: Prisma.SubscriptionUpdateInput;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly couponsService: CouponsService,
    private readonly financialEventsService: FinancialEventsService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateSubscriptionDto,
    meta: RequestMeta,
  ) {
    if (dto.idempotencyKey) {
      const existingEvent = await this.prisma.subscriptionEvent.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingEvent) {
        return this.prisma.subscription.findUniqueOrThrow({
          where: { id: existingEvent.subscriptionId },
        });
      }
    }

    const [customer, plan, price] = await Promise.all([
      this.prisma.customer.findUniqueOrThrow({ where: { id: dto.customerId } }),
      this.prisma.plan.findUniqueOrThrow({ where: { id: dto.planId }, include: { product: true } }),
      this.prisma.price.findUniqueOrThrow({ where: { id: dto.priceId } }),
    ]);

    if (
      customer.organizationId !== organizationId ||
      plan.product.organizationId !== organizationId
    ) {
      throw new NotFoundException("Customer or plan not found in this organization");
    }

    const startTrial = Boolean(dto.startTrial && plan.trialEligible && plan.trialDays);
    const now = new Date();

    const subscription = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          organizationId,
          customerId: dto.customerId,
          productId: plan.productId,
          planId: dto.planId,
          applicationId: plan.product.applicationId,
          environmentType: dto.environmentType ?? ApplicationEnvironmentType.PRODUCTION,
          provider: dto.provider ?? SubscriptionProvider.MANUAL,
          providerSubscriptionId: dto.providerSubscriptionId,
          quantity: dto.quantity ?? 1,
          metadata: dto.metadata,
          status: startTrial ? "TRIALING" : "ACTIVE",
          trialStart: startTrial ? now : undefined,
          trialEnd: startTrial ? addDays(now, plan.trialDays!) : undefined,
          currentPeriodStart: startTrial ? undefined : now,
          currentPeriodEnd: startTrial
            ? undefined
            : addBillingInterval(now, price.interval, price.intervalCount),
        },
      });

      await tx.subscriptionItem.create({
        data: { subscriptionId: created.id, priceId: dto.priceId, quantity: dto.quantity ?? 1 },
      });

      if (startTrial) {
        try {
          await tx.trial.create({
            data: {
              customerId: dto.customerId,
              productId: plan.productId,
              planId: dto.planId,
              subscriptionId: created.id,
              endsAt: addDays(now, plan.trialDays!),
              ipAddress: meta.ipAddress,
            },
          });
        } catch {
          throw new ConflictException("This customer has already used a trial for this product");
        }
      }

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: created.id,
          type: startTrial ? "TRIAL_STARTED" : "CREATED",
          toStatus: created.status,
          idempotencyKey: dto.idempotencyKey,
          createdById: userId,
        },
      });

      return created;
    });

    await this.auditService.record({
      action: "SUBSCRIPTION_CREATED",
      userId,
      organizationId,
      applicationId: plan.product.applicationId,
      metadata: { subscriptionId: subscription.id, customerId: dto.customerId, planId: dto.planId },
      ...meta,
    });

    return subscription;
  }

  async list(organizationId: string, query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.subscription.findMany({
      where: cursorWhere ? { organizationId, ...cursorWhere } : { organizationId },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
      include: { items: { include: { price: true } } },
    });

    return paginateResults(rows, limit);
  }

  async getOne(subscriptionId: string, organizationId: string) {
    return this.getOwned(subscriptionId, organizationId);
  }

  async listEvents(subscriptionId: string, query: CursorQueryDto) {
    const limit = normalizePageSize(query.limit);
    const cursorWhere = buildCursorWhereClause(query.cursor);

    const rows = await this.prisma.subscriptionEvent.findMany({
      where: cursorWhere ? { subscriptionId, ...cursorWhere } : { subscriptionId },
      orderBy: CURSOR_ORDER_BY,
      take: limit + 1,
    });

    return paginateResults(rows, limit);
  }

  // ---- Lifecycle transitions ----
  // Every transition goes through `runTransition`, which enforces the state
  // machine, optimistic concurrency, idempotency, and immutable event
  // recording inside a single database transaction.

  async activate(
    subscriptionId: string,
    userId: string,
    options: MutationOptionsDto,
    meta: RequestMeta,
  ) {
    return this.runTransition(subscriptionId, options, userId, meta, async (tx, sub) => {
      const item = await tx.subscriptionItem.findFirstOrThrow({
        where: { subscriptionId: sub.id },
        include: { price: true },
      });
      const now = new Date();

      if (sub.status === "TRIALING" && sub.trial) {
        await tx.trial.update({
          where: { id: sub.trial.id },
          data: { status: TrialStatus.CONVERTED, convertedAt: now },
        });
      }

      return {
        toStatus: "ACTIVE",
        eventType: sub.status === "TRIALING" ? "TRIAL_CONVERTED" : "ACTIVATED",
        data: {
          currentPeriodStart: now,
          currentPeriodEnd: addBillingInterval(now, item.price.interval, item.price.intervalCount),
          trialEnd: sub.status === "TRIALING" ? now : undefined,
        },
      };
    });
  }

  async renew(
    subscriptionId: string,
    userId: string,
    options: MutationOptionsDto,
    meta: RequestMeta,
  ) {
    return this.runTransition(subscriptionId, options, userId, meta, async (tx, sub) => {
      // A due, PENDING cancel-at-period-end change wins over renewal.
      const dueCancel = await tx.subscriptionChange.findFirst({
        where: {
          subscriptionId: sub.id,
          status: SubscriptionChangeStatus.PENDING,
          type: SubscriptionChangeType.CANCEL_AT_PERIOD_END,
          effectiveAt: { lte: new Date() },
        },
      });
      if (dueCancel || sub.cancelAtPeriodEnd) {
        if (dueCancel) {
          await tx.subscriptionChange.update({
            where: { id: dueCancel.id },
            data: { status: SubscriptionChangeStatus.APPLIED, appliedAt: new Date() },
          });
        }
        return { toStatus: "CANCELED", eventType: "CANCELED", data: { canceledAt: new Date() } };
      }

      // Apply any other due scheduled change (downgrade, interval switch,
      // seat reduction) before computing the new period.
      const dueChange = await tx.subscriptionChange.findFirst({
        where: {
          subscriptionId: sub.id,
          status: SubscriptionChangeStatus.PENDING,
          effectiveAt: { lte: new Date() },
        },
      });

      let planId = sub.planId;
      let priceId: string | undefined;
      let quantity = sub.quantity;

      if (dueChange) {
        if (dueChange.targetPlanId) planId = dueChange.targetPlanId;
        if (dueChange.targetPriceId) priceId = dueChange.targetPriceId;
        if (dueChange.targetQuantity !== null && dueChange.targetQuantity !== undefined) {
          quantity = dueChange.targetQuantity;
        }
        await tx.subscriptionChange.update({
          where: { id: dueChange.id },
          data: { status: SubscriptionChangeStatus.APPLIED, appliedAt: new Date() },
        });
      }

      const currentItem = await tx.subscriptionItem.findFirstOrThrow({
        where: { subscriptionId: sub.id },
        include: { price: true },
      });

      if (priceId && priceId !== currentItem.priceId) {
        await tx.subscriptionItem.update({
          where: { id: currentItem.id },
          data: { priceId, quantity },
        });
      } else if (quantity !== sub.quantity) {
        await tx.subscriptionItem.update({ where: { id: currentItem.id }, data: { quantity } });
      }

      const price = priceId
        ? await tx.price.findUniqueOrThrow({ where: { id: priceId } })
        : currentItem.price;
      const periodStart = sub.currentPeriodEnd ?? new Date();

      return {
        toStatus: "ACTIVE",
        eventType: dueChange ? "SCHEDULED_CHANGE_APPLIED" : "RENEWED",
        data: {
          planId,
          quantity,
          currentPeriodStart: periodStart,
          currentPeriodEnd: addBillingInterval(periodStart, price.interval, price.intervalCount),
        },
        metadata: dueChange ? { appliedChangeId: dueChange.id } : undefined,
      };
    });
  }

  async applyChange(
    subscriptionId: string,
    userId: string,
    dto: CreateSubscriptionChangeDto,
    meta: RequestMeta,
  ) {
    const sub = await this.getOwnedById(subscriptionId);

    if (!dto.immediate) {
      const change = await this.prisma.subscriptionChange.create({
        data: {
          subscriptionId,
          type: dto.type,
          targetPlanId: dto.targetPlanId,
          targetPriceId: dto.targetPriceId,
          targetQuantity: dto.targetQuantity,
          effectiveAt: sub.currentPeriodEnd ?? new Date(),
          createdById: userId,
        },
      });

      await this.prisma.subscriptionEvent.create({
        data: {
          subscriptionId,
          type: "SCHEDULED_CHANGE_CREATED",
          idempotencyKey: dto.idempotencyKey,
          metadata: { changeId: change.id, type: dto.type },
          createdById: userId,
        },
      });

      await this.auditService.record({
        action: "SUBSCRIPTION_CHANGE_SCHEDULED",
        userId,
        organizationId: sub.organizationId,
        applicationId: sub.applicationId,
        metadata: { subscriptionId, changeId: change.id, type: dto.type },
        ...meta,
      });

      return change;
    }

    // Immediate application: proration now, no PENDING SubscriptionChange row.
    let prorationInfo: { id: string; netMinor: number; currency: string; reason: string } | null =
      null;

    const result = await this.runTransition(
      subscriptionId,
      dto,
      userId,
      meta,
      async (tx, current) => {
        const currentItem = await tx.subscriptionItem.findFirstOrThrow({
          where: { subscriptionId: current.id },
          include: { price: true },
        });

        const newPrice = dto.targetPriceId
          ? await tx.price.findUniqueOrThrow({ where: { id: dto.targetPriceId } })
          : currentItem.price;
        const newQuantity = dto.targetQuantity ?? current.quantity;

        const periodStart = current.currentPeriodStart ?? new Date();
        const periodEnd =
          current.currentPeriodEnd ??
          addBillingInterval(periodStart, newPrice.interval, newPrice.intervalCount);

        const proration = calculateProration({
          periodStart,
          periodEnd,
          now: new Date(),
          oldAmountMinor: currentItem.price.amountMinor * currentItem.quantity,
          newAmountMinor: newPrice.amountMinor * newQuantity,
        });

        const reason = prorationReasonFor(dto.type, currentItem.quantity, newQuantity);
        const record = await tx.prorationRecord.create({
          data: {
            subscriptionId: current.id,
            reason,
            creditMinor: proration.creditMinor,
            chargeMinor: proration.chargeMinor,
            netMinor: proration.netMinor,
            currency: newPrice.currency,
            periodStart,
            periodEnd,
          },
        });
        prorationInfo = {
          id: record.id,
          netMinor: proration.netMinor,
          currency: newPrice.currency,
          reason,
        };

        if (dto.targetPriceId || dto.targetQuantity !== undefined || dto.targetPlanId) {
          await tx.subscriptionItem.update({
            where: { id: currentItem.id },
            data: { priceId: newPrice.id, quantity: newQuantity },
          });
        }

        return {
          toStatus: "ACTIVE",
          eventType: eventTypeFor(dto.type),
          data: { planId: dto.targetPlanId ?? current.planId, quantity: newQuantity },
          metadata: { netMinor: proration.netMinor, currency: newPrice.currency },
        };
      },
    );

    // Recorded after the transition transaction commits - a proration
    // charge/credit is an "upgrade payment" / "proration charge" financial
    // event (see FinancialEventsService), computed here because this is the
    // one place in the codebase that actually calculates the amount.
    if (prorationInfo) {
      const info: { id: string; netMinor: number; currency: string; reason: string } =
        prorationInfo;
      await this.financialEventsService.record(
        sub.organizationId,
        "PAYMENT_SUCCEEDED",
        {
          reason: info.netMinor >= 0 ? "upgrade_proration_charge" : "downgrade_proration_credit",
          prorationRecordId: info.id,
          subscriptionId: sub.id,
          netMinor: info.netMinor,
          amountMinor: Math.abs(info.netMinor),
          currency: info.currency,
          taxMinor: 0,
          discountMinor: 0,
          prorationReason: info.reason,
          description: `Proration (${info.reason}) for subscription ${sub.id}`,
        },
        { applicationId: sub.applicationId, customerId: sub.customerId, subscriptionId: sub.id },
        userId,
        meta,
        `proration:${info.id}`,
      );
    }

    return result;
  }

  async listChanges(subscriptionId: string) {
    return this.prisma.subscriptionChange.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: "desc" },
    });
  }

  async applyCoupon(subscriptionId: string, userId: string, dto: RedeemCouponDto) {
    const subscription = await this.getOwnedById(subscriptionId);

    const { coupon, promotionCode } = await this.couponsService.resolveForRedemption(
      subscription.organizationId,
      dto,
      subscription,
    );

    const subscriptionCoupon = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subscriptionCoupon.create({
        data: {
          subscriptionId,
          couponId: coupon.id,
          promotionCodeId: promotionCode?.id,
          customerId: subscription.customerId,
        },
      });

      await tx.coupon.update({
        where: { id: coupon.id },
        data: { redemptionCount: { increment: 1 } },
      });
      if (promotionCode) {
        await tx.promotionCode.update({
          where: { id: promotionCode.id },
          data: { redemptionCount: { increment: 1 } },
        });
      }

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId,
          type: "COUPON_APPLIED",
          metadata: { couponId: coupon.id, promotionCodeId: promotionCode?.id },
          createdById: userId,
        },
      });

      return created;
    });

    return subscriptionCoupon;
  }

  async removeCoupon(subscriptionId: string, subscriptionCouponId: string, userId: string) {
    const subscriptionCoupon = await this.prisma.subscriptionCoupon.findUnique({
      where: { id: subscriptionCouponId },
    });
    if (
      !subscriptionCoupon ||
      subscriptionCoupon.subscriptionId !== subscriptionId ||
      subscriptionCoupon.removedAt
    ) {
      throw new NotFoundException("Applied coupon not found");
    }

    const updated = await this.prisma.subscriptionCoupon.update({
      where: { id: subscriptionCouponId },
      data: { removedAt: new Date() },
    });

    await this.prisma.subscriptionEvent.create({
      data: {
        subscriptionId,
        type: "COUPON_REMOVED",
        metadata: { subscriptionCouponId },
        createdById: userId,
      },
    });

    return updated;
  }

  async cancelScheduledChange(
    subscriptionId: string,
    changeId: string,
    userId: string,
    meta: RequestMeta,
  ) {
    const change = await this.prisma.subscriptionChange.findUnique({ where: { id: changeId } });
    if (
      !change ||
      change.subscriptionId !== subscriptionId ||
      change.status !== SubscriptionChangeStatus.PENDING
    ) {
      throw new NotFoundException("Pending scheduled change not found");
    }

    const updated = await this.prisma.subscriptionChange.update({
      where: { id: changeId },
      data: { status: SubscriptionChangeStatus.CANCELED, canceledAt: new Date() },
    });

    await this.prisma.subscriptionEvent.create({
      data: {
        subscriptionId,
        type: "SCHEDULED_CHANGE_CANCELED",
        metadata: { changeId },
        createdById: userId,
      },
    });

    const sub = await this.getOwnedById(subscriptionId);
    await this.auditService.record({
      action: "SUBSCRIPTION_CHANGE_CANCELED",
      userId,
      organizationId: sub.organizationId,
      applicationId: sub.applicationId,
      metadata: { subscriptionId, changeId },
      ...meta,
    });

    return updated;
  }

  async cancel(
    subscriptionId: string,
    userId: string,
    dto: CancelSubscriptionDto,
    meta: RequestMeta,
  ) {
    if (dto.atPeriodEnd) {
      const sub = await this.getOwnedById(subscriptionId);
      const updated = await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          cancelAtPeriodEnd: true,
          cancellationReason: dto.reason,
          version: { increment: 1 },
        },
      });

      await this.prisma.subscriptionChange.create({
        data: {
          subscriptionId,
          type: SubscriptionChangeType.CANCEL_AT_PERIOD_END,
          effectiveAt: sub.currentPeriodEnd ?? new Date(),
          createdById: userId,
        },
      });

      await this.prisma.subscriptionEvent.create({
        data: {
          subscriptionId,
          type: "CANCEL_SCHEDULED",
          idempotencyKey: dto.idempotencyKey,
          metadata: { reason: dto.reason },
          createdById: userId,
        },
      });

      await this.auditService.record({
        action: "SUBSCRIPTION_CANCELED",
        userId,
        organizationId: sub.organizationId,
        applicationId: sub.applicationId,
        metadata: { subscriptionId, atPeriodEnd: true },
        ...meta,
      });

      return updated;
    }

    const result = await this.runTransition(subscriptionId, dto, userId, meta, async () => ({
      toStatus: "CANCELED",
      eventType: "CANCELED",
      data: { canceledAt: new Date(), cancellationReason: dto.reason },
      metadata: { reason: dto.reason },
    }));

    const sub = await this.getOwnedById(subscriptionId);
    await this.auditService.record({
      action: "SUBSCRIPTION_CANCELED",
      userId,
      organizationId: sub.organizationId,
      applicationId: sub.applicationId,
      metadata: { subscriptionId, atPeriodEnd: false },
      ...meta,
    });

    return result;
  }

  async resume(
    subscriptionId: string,
    userId: string,
    options: MutationOptionsDto,
    meta: RequestMeta,
  ) {
    return this.runTransition(subscriptionId, options, userId, meta, async () => ({
      toStatus: "ACTIVE",
      eventType: "RESUMED",
      data: { cancelAtPeriodEnd: false, canceledAt: null, cancellationReason: null },
    }));
  }

  async pause(
    subscriptionId: string,
    userId: string,
    options: MutationOptionsDto,
    meta: RequestMeta,
  ) {
    return this.runTransition(subscriptionId, options, userId, meta, async () => ({
      toStatus: "PAUSED",
      eventType: "PAUSED",
    }));
  }

  async markPastDue(
    subscriptionId: string,
    userId: string,
    options: MutationOptionsDto,
    meta: RequestMeta,
  ) {
    return this.runTransition(subscriptionId, options, userId, meta, async () => ({
      toStatus: "PAST_DUE",
      eventType: "PAYMENT_FAILED",
    }));
  }

  async enterGracePeriod(
    subscriptionId: string,
    userId: string,
    dto: GracePeriodDto,
    meta: RequestMeta,
  ) {
    return this.runTransition(subscriptionId, dto, userId, meta, async () => ({
      toStatus: "GRACE_PERIOD",
      eventType: "GRACE_PERIOD_STARTED",
      data: { gracePeriodEnd: addDays(new Date(), dto.graceDays ?? 3) },
    }));
  }

  async expire(
    subscriptionId: string,
    userId: string,
    options: MutationOptionsDto,
    meta: RequestMeta,
  ) {
    return this.runTransition(subscriptionId, options, userId, meta, async (tx, sub) => {
      if (sub.status === "TRIALING" && sub.trial) {
        await tx.trial.update({
          where: { id: sub.trial.id },
          data: { status: TrialStatus.EXPIRED },
        });
      }
      return {
        toStatus: "EXPIRED",
        eventType: sub.status === "TRIALING" ? "TRIAL_EXPIRED" : "EXPIRED",
      };
    });
  }

  async suspend(
    subscriptionId: string,
    userId: string,
    dto: SuspendSubscriptionDto,
    meta: RequestMeta,
  ) {
    return this.runTransition(subscriptionId, dto, userId, meta, async () => ({
      toStatus: "SUSPENDED",
      eventType: "SUSPENDED",
      metadata: { reason: dto.reason },
    }));
  }

  async reactivate(
    subscriptionId: string,
    userId: string,
    options: MutationOptionsDto,
    meta: RequestMeta,
  ) {
    return this.runTransition(subscriptionId, options, userId, meta, async () => ({
      toStatus: "ACTIVE",
      eventType: "REACTIVATED",
    }));
  }

  /**
   * Phase 9 admin-only capability: directly extends `Subscription.trialEnd`
   * (and the linked `Trial.endsAt`, if a `Trial` row exists for this
   * subscription) without going through the normal TRIALING -> ACTIVE
   * transition machinery - there is no lifecycle event for "the trial got
   * longer", just a later deadline. Only valid while the subscription is
   * still TRIALING. No dedicated `SubscriptionEventType` exists in the
   * (frozen) schema for "trial extended", so this intentionally does not
   * write a `SubscriptionEvent` row, matching `activate`/`renew`/etc.'s
   * `runTransition` shape rather than `cancel`/`create`'s self-auditing
   * shape - the Phase 9 admin surface calling this records its own audit
   * trail via `AuditAction.SUBSCRIPTION_ADMIN_ACTION`.
   */
  async extendTrial(
    subscriptionId: string,
    _userId: string,
    newTrialEnd: Date,
    _meta: RequestMeta,
  ): Promise<Subscription> {
    const subscription = await this.getOwnedById(subscriptionId);
    if (subscription.status !== "TRIALING") {
      throw new ConflictException("Only a TRIALING subscription's trial can be extended");
    }

    const trial = await this.prisma.trial.findUnique({ where: { subscriptionId } });

    const [updated] = await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: { trialEnd: newTrialEnd, version: { increment: 1 } },
      }),
      ...(trial
        ? [this.prisma.trial.update({ where: { id: trial.id }, data: { endsAt: newTrialEnd } })]
        : []),
    ]);

    return updated;
  }

  // ---- internals ----

  private async getOwned(subscriptionId: string, organizationId: string): Promise<Subscription> {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub || sub.organizationId !== organizationId) {
      throw new NotFoundException("Subscription not found");
    }
    return sub;
  }

  private async getOwnedById(subscriptionId: string): Promise<Subscription> {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) {
      throw new NotFoundException("Subscription not found");
    }
    return sub;
  }

  private async runTransition(
    subscriptionId: string,
    options: MutationOptionsDto,
    userId: string,
    _meta: RequestMeta,
    compute: (
      tx: Tx,
      subscription: Subscription & { trial: { id: string } | null },
    ) => Promise<TransitionResult>,
  ): Promise<Subscription> {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: { trial: { select: { id: true } } },
      });
      if (!subscription) {
        throw new NotFoundException("Subscription not found");
      }

      if (options.idempotencyKey) {
        const existingEvent = await tx.subscriptionEvent.findUnique({
          where: { idempotencyKey: options.idempotencyKey },
        });
        if (existingEvent) {
          return subscription;
        }
      }

      if (
        options.expectedVersion !== undefined &&
        subscription.version !== options.expectedVersion
      ) {
        throw new ConflictException(
          "Subscription has been modified since expectedVersion - refetch and retry",
        );
      }

      const { toStatus, eventType, data, metadata } = await compute(tx, subscription);

      assertTransition(subscription.status, toStatus);

      const updated = await tx.subscription.update({
        where: { id: subscriptionId },
        data: { ...data, status: toStatus, version: { increment: 1 } },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId,
          type: eventType,
          fromStatus: subscription.status,
          toStatus,
          idempotencyKey: options.idempotencyKey,
          metadata,
          createdById: userId,
        },
      });

      return updated;
    });
  }
}

function addDays(from: Date, days: number): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  return result;
}

function prorationReasonFor(
  type: SubscriptionChangeType,
  oldQuantity: number,
  newQuantity: number,
) {
  switch (type) {
    case SubscriptionChangeType.UPGRADE:
      return "UPGRADE" as const;
    case SubscriptionChangeType.DOWNGRADE:
      return "DOWNGRADE" as const;
    case SubscriptionChangeType.SEAT_CHANGE:
      return newQuantity >= oldQuantity ? ("SEAT_INCREASE" as const) : ("SEAT_DECREASE" as const);
    case SubscriptionChangeType.INTERVAL_CHANGE:
      return "INTERVAL_CHANGE" as const;
    default:
      return "UPGRADE" as const;
  }
}

function eventTypeFor(type: SubscriptionChangeType): SubscriptionEventType {
  switch (type) {
    case SubscriptionChangeType.UPGRADE:
      return "UPGRADED";
    case SubscriptionChangeType.DOWNGRADE:
      return "DOWNGRADED";
    case SubscriptionChangeType.INTERVAL_CHANGE:
      return "INTERVAL_CHANGED";
    case SubscriptionChangeType.SEAT_CHANGE:
      return "SEATS_CHANGED";
    default:
      return "UPGRADED";
  }
}
