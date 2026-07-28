import { Injectable } from "@nestjs/common";
import type { Customer, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerOwnershipService } from "./customer-ownership.service";

const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "ACTIVE",
  "TRIALING",
  "GRACE_PERIOD",
  "PAST_DUE",
];

@Injectable()
export class CustomerDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: CustomerOwnershipService,
  ) {}

  /** A cheap summary aggregation - a handful of counts/single-row lookups, never a heavy join. */
  async getSummary(customerId: string, userId: string) {
    const customer = await this.ownership.loadOwnedCustomer(customerId, userId);

    const [
      activeSubscriptionCount,
      upcomingRenewal,
      licenseCount,
      deviceCount,
      unreadNotificationCount,
    ] = await Promise.all([
      this.prisma.subscription.count({
        where: { customerId, status: { in: ACTIVE_SUBSCRIPTION_STATUSES } },
      }),
      this.prisma.subscription.findFirst({
        where: {
          customerId,
          status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
          currentPeriodEnd: { not: null },
        },
        orderBy: { currentPeriodEnd: "asc" },
        select: { currentPeriodEnd: true },
      }),
      this.countLicenses(customer),
      customer.userId
        ? this.prisma.deviceRegistration.count({
            where: { userId: customer.userId, status: { not: "REMOVED" } },
          })
        : 0,
      customer.userId
        ? this.prisma.notification.count({ where: { userId: customer.userId, readAt: null } })
        : 0,
    ]);

    return {
      activeSubscriptionCount,
      upcomingRenewalDate: upcomingRenewal?.currentPeriodEnd ?? null,
      licenseCount,
      deviceCount,
      unreadNotificationCount,
    };
  }

  /** See `CustomerLicensesService` for the full explanation of this join choice. */
  private async countLicenses(customer: Customer): Promise<number> {
    if (!customer.userId) return 0;
    return this.prisma.license.count({
      where: {
        OR: [
          { subscription: { customerId: customer.id } },
          { assignments: { some: { userId: customer.userId } } },
          { seats: { some: { assignments: { some: { userId: customer.userId } } } } },
        ],
      },
    });
  }
}
