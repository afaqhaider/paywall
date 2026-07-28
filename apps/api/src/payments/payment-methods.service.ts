import { Injectable, NotFoundException } from "@nestjs/common";
import { PaymentMethodStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { paymentCustomer: { customer: { organizationId } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async remove(paymentMethodId: string, organizationId: string, userId: string, meta: RequestMeta) {
    const method = await this.prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId },
      include: { paymentCustomer: { include: { customer: true } } },
    });
    if (!method || method.paymentCustomer.customer.organizationId !== organizationId) {
      throw new NotFoundException("Payment method not found");
    }

    const updated = await this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { status: PaymentMethodStatus.REMOVED, removedAt: new Date() },
    });

    await this.auditService.record({
      action: "PAYMENT_METHOD_REMOVED",
      userId,
      organizationId,
      metadata: { paymentMethodId },
      ...meta,
    });

    return updated;
  }
}
