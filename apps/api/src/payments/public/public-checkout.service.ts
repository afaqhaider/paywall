import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentProviderStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import type { RequestMeta } from "../../common/utils/request-meta.util";
import type { ApiKeyRequestContext } from "../../common/guards/api-key.guard";
import { SystemActorService } from "../system-actor.service";
import { CheckoutService } from "../checkout.service";
import type { CreateCheckoutIntentDto } from "./dto/create-checkout-intent.dto";

const INTENT_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * The "developer embed" front (merge plan checkpoint 6): a third-party app
 * like "LedGix Expense Tracker" calls `GET /public/plans` +
 * `POST /public/checkout-intents` with its API key to fetch a hosted
 * checkout URL for a plan its own user picked. The intent exists because
 * `PaymentCheckoutSession` requires a payment provider to already be chosen,
 * but the calling app doesn't know (or care) which provider to use - the
 * hosted checkout page (apps/web `/checkout/[intentId]`) presents that
 * choice to the end customer instead.
 */
@Injectable()
export class PublicCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly systemActor: SystemActorService,
    private readonly checkoutService: CheckoutService,
  ) {}

  async listPlans(apiKeyContext: ApiKeyRequestContext) {
    return this.prisma.plan.findMany({
      where: {
        status: "ACTIVE",
        product: {
          organizationId: apiKeyContext.organizationId,
          ...(apiKeyContext.applicationId ? { applicationId: apiKeyContext.applicationId } : {}),
        },
      },
      include: { prices: { where: { status: "ACTIVE" } } },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createIntent(apiKeyContext: ApiKeyRequestContext, dto: CreateCheckoutIntentDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
      include: { product: true },
    });
    if (!plan || plan.product.organizationId !== apiKeyContext.organizationId) {
      throw new NotFoundException("Plan not found");
    }

    const price = await this.prisma.price.findUnique({ where: { id: dto.priceId } });
    if (!price || price.planId !== plan.id) {
      throw new NotFoundException("Price not found on this plan");
    }

    return this.prisma.checkoutIntent.create({
      data: {
        organizationId: apiKeyContext.organizationId,
        applicationId: apiKeyContext.applicationId,
        customerEmail: dto.customerEmail,
        planId: dto.planId,
        priceId: dto.priceId,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
        expiresAt: new Date(Date.now() + INTENT_TTL_MS),
      },
    });
  }

  /** Public read - the hosted checkout page's own load, no API key (the
   * end customer's browser calls this directly). */
  async getIntent(intentId: string) {
    const intent = await this.prisma.checkoutIntent.findUnique({
      where: { id: intentId },
      include: { plan: { include: { product: true } }, price: true },
    });
    if (!intent) {
      throw new NotFoundException("Checkout link not found");
    }
    if (intent.status !== "PENDING" || intent.expiresAt < new Date()) {
      throw new BadRequestException("This checkout link has expired or already been used");
    }

    const providers = await this.prisma.paymentProvider.findMany({
      where: { organizationId: intent.organizationId, status: PaymentProviderStatus.ACTIVE },
      select: { id: true, type: true, displayName: true },
    });

    return { intent, providers };
  }

  /** Customer picked a provider on the hosted page - creates the real
   * `PaymentCheckoutSession` via the existing `CheckoutService` (never
   * duplicates its provider-call/customer-linking logic) and claims the
   * intent so it can't be completed twice. */
  async completeIntent(intentId: string, providerId: string, meta: RequestMeta) {
    const intent = await this.prisma.checkoutIntent.findUnique({ where: { id: intentId } });
    if (!intent) {
      throw new NotFoundException("Checkout link not found");
    }
    if (intent.status !== "PENDING" || intent.expiresAt < new Date()) {
      throw new BadRequestException("This checkout link has expired or already been used");
    }

    const provider = await this.prisma.paymentProvider.findUnique({ where: { id: providerId } });
    if (!provider || provider.organizationId !== intent.organizationId) {
      throw new NotFoundException("Payment provider not found for this organization");
    }

    let customer = await this.prisma.customer.findFirst({
      where: {
        organizationId: intent.organizationId,
        applicationId: intent.applicationId,
        email: intent.customerEmail,
      },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          organizationId: intent.organizationId,
          applicationId: intent.applicationId,
          email: intent.customerEmail,
          displayName: intent.customerEmail,
        },
      });
    }

    const systemUserId = await this.systemActor.getSystemUserId();
    const session = await this.checkoutService.create(
      intent.organizationId,
      systemUserId,
      {
        providerId,
        customerId: customer.id,
        priceId: intent.priceId,
        planId: intent.planId,
        successUrl: intent.successUrl ?? undefined,
        cancelUrl: intent.cancelUrl ?? undefined,
      },
      meta,
    );

    await this.prisma.checkoutIntent.update({
      where: { id: intentId },
      data: { status: "COMPLETED", checkoutSessionId: session.id, completedAt: new Date() },
    });

    await this.auditService.record({
      action: "CHECKOUT_SESSION_CREATED",
      organizationId: intent.organizationId,
      metadata: { intentId, checkoutSessionId: session.id, source: "embedded-checkout-widget" },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return session;
  }
}
