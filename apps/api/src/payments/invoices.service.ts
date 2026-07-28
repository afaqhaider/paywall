import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    return this.prisma.paymentInvoice.findMany({
      where: { customer: { organizationId } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async getOne(invoiceId: string, organizationId: string) {
    const invoice = await this.prisma.paymentInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException("Invoice not found");
    }
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: invoice.customerId },
    });
    if (customer.organizationId !== organizationId) {
      throw new NotFoundException("Invoice not found");
    }
    return invoice;
  }
}
