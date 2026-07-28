import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MeCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * "Organizations" in the Customer Portal's navigation = "which of my
   * Customer relationships am I currently viewing" - analogous to the
   * Developer Portal's OrgSwitcher, but over `Customer` rows rather than
   * `OrganizationMember` rows. A single `User` may have several (e.g. they
   * bought subscriptions from two different applications).
   */
  async listForUser(userId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { userId },
      include: {
        organization: { select: { name: true } },
        application: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return customers.map((customer) => ({
      customerId: customer.id,
      organizationId: customer.organizationId,
      organizationName: customer.organization.name,
      applicationId: customer.applicationId,
      applicationName: customer.application?.name ?? null,
      displayName: customer.displayName,
      type: customer.type,
    }));
  }
}
