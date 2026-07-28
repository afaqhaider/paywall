import { Injectable, NotFoundException } from "@nestjs/common";
import type { Customer } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * The Customer Portal's self-service ownership boundary: every route scoped
 * to a `:customerId` route param must resolve it through this before
 * touching any of that customer's data. Deliberately simpler than
 * `ApplicationRoleGuard` (no role hierarchy, no org/app membership) - a
 * logged-in `User` either owns the `Customer` row (`customer.userId ===
 * currentUser.id`) or gets a 404 (never a 403, so a guessed customerId
 * doesn't even confirm the row exists).
 */
@Injectable()
export class CustomerOwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  async loadOwnedCustomer(customerId: string, userId: string): Promise<Customer> {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer || customer.userId !== userId) {
      throw new NotFoundException("Customer not found");
    }
    return customer;
  }
}
