import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentCheckoutSessionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import { ProviderResolverService } from "./provider-resolver.service";
import type { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly resolver: ProviderResolverService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateCheckoutSessionDto,
    meta: RequestMeta,
  ) {
    const [{ adapter, credentials, account }, price, customer] = await Promise.all([
      this.resolver.resolve(dto.providerId),
      this.prisma.price.findUniqueOrThrow({ where: { id: dto.priceId } }),
      this.prisma.customer.findUniqueOrThrow({ where: { id: dto.customerId } }),
    ]);

    if (customer.organizationId !== organizationId) {
      throw new NotFoundException("Customer not found in this organization");
    }

    let paymentCustomer = await this.prisma.paymentCustomer.findUnique({
      where: { customerId_providerId: { customerId: dto.customerId, providerId: dto.providerId } },
    });

    if (!paymentCustomer) {
      const created = await adapter.createCustomer({
        customerId: dto.customerId,
        email: customer.email ?? undefined,
        name: customer.displayName ?? undefined,
        metadata: {},
        credentials,
        account,
      });
      paymentCustomer = await this.prisma.paymentCustomer.create({
        data: {
          customerId: dto.customerId,
          providerId: dto.providerId,
          externalCustomerId: created.externalCustomerId,
        },
      });
    }

    const checkout = await adapter.createCheckout({
      externalCustomerId: paymentCustomer.externalCustomerId,
      priceId: price.id,
      providerPriceRef: price.providerRef ?? price.id,
      amountMinor: price.amountMinor,
      currency: price.currency,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      metadata: dto.metadata as Record<string, unknown>,
      credentials,
      account,
    });

    const session = await this.prisma.paymentCheckoutSession.create({
      data: {
        providerId: dto.providerId,
        customerId: dto.customerId,
        productId: dto.productId,
        planId: dto.planId,
        priceId: dto.priceId,
        status: PaymentCheckoutSessionStatus.OPEN,
        checkoutUrl: checkout.checkoutUrl,
        providerReference: checkout.providerReference,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
        metadata: dto.metadata,
        expiresAt: checkout.expiresAt,
      },
    });

    await this.auditService.record({
      action: "CHECKOUT_SESSION_CREATED",
      userId,
      organizationId,
      metadata: { checkoutSessionId: session.id, providerId: dto.providerId },
      ...meta,
    });

    return session;
  }

  async list(organizationId: string) {
    return this.prisma.paymentCheckoutSession.findMany({
      where: { customer: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async getOne(checkoutSessionId: string, organizationId: string) {
    const session = await this.prisma.paymentCheckoutSession.findUnique({
      where: { id: checkoutSessionId },
      include: { customer: true },
    });
    if (!session || session.customer.organizationId !== organizationId) {
      throw new NotFoundException("Checkout session not found");
    }
    return session;
  }
}
