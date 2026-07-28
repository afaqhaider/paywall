import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    return this.prisma.paymentDispute.findMany({
      where: { transaction: { customer: { organizationId } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async getOne(disputeId: string, organizationId: string) {
    const dispute = await this.prisma.paymentDispute.findUnique({
      where: { id: disputeId },
      include: { transaction: true },
    });
    if (!dispute) {
      throw new NotFoundException("Dispute not found");
    }
    const customer = await this.prisma.customer.findUniqueOrThrow({
      where: { id: dispute.transaction.customerId },
    });
    if (customer.organizationId !== organizationId) {
      throw new NotFoundException("Dispute not found");
    }
    return dispute;
  }
}
