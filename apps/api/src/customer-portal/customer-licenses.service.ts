import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerOwnershipService } from "./customer-ownership.service";

@Injectable()
export class CustomerLicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: CustomerOwnershipService,
  ) {}

  /**
   * `License` has no direct `customerId` column, so "licenses this customer
   * has" is resolved as the union of every path that actually attaches a
   * License to this customer relationship:
   *   (a) licenses derived from one of the customer's own Subscriptions
   *       (`License.subscription.customerId`), and
   *   (b) licenses individually- or seat-assigned to the customer's
   *       underlying `User` (`LicenseAssignment.userId` /
   *       `Seat.assignments.userId`).
   * A `Customer` with no linked `User` (`userId` null) can only ever have
   * (a).
   */
  async list(customerId: string, userId: string) {
    const customer = await this.ownership.loadOwnedCustomer(customerId, userId);
    const linkedUserId = customer.userId;
    // A value no real userId can ever equal - keeps the `include` shape
    // uniform (always an object) when the customer has no linked User.
    const assignmentFilter = linkedUserId ?? "__no_linked_user__";

    return this.prisma.license.findMany({
      where: {
        OR: [
          { subscription: { customerId } },
          ...(linkedUserId
            ? [
                { assignments: { some: { userId: linkedUserId } } },
                { seats: { some: { assignments: { some: { userId: linkedUserId } } } } },
              ]
            : []),
        ],
      },
      include: {
        assignments: { where: { userId: assignmentFilter } },
        seats: { include: { assignments: { where: { userId: assignmentFilter } } } },
        licenseKeys: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
