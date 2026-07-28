import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RuntimeAuthorizationService } from "../entitlements/runtime-authorization.service";
import { CustomerOwnershipService } from "./customer-ownership.service";

@Injectable()
export class CustomerUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: CustomerOwnershipService,
    private readonly runtimeAuthorizationService: RuntimeAuthorizationService,
  ) {}

  /**
   * Drives the "Storage/Projects/Employees/API Usage/AI Usage/Exports/
   * Remaining Limits" view entirely from whatever `EntitlementDefinition`
   * keys the developer already configured for this application, reusing
   * Phase 6's `RuntimeAuthorizationService.getUsage()` - no new
   * usage-tracking logic here.
   */
  async getUsage(customerId: string, userId: string) {
    const customer = await this.ownership.loadOwnedCustomer(customerId, userId);
    if (!customer.applicationId) {
      return [];
    }
    const applicationId = customer.applicationId;

    const definitions = await this.prisma.entitlementDefinition.findMany({
      where: { applicationId, archivedAt: null },
    });

    return Promise.all(
      definitions.map(async (definition) => {
        const usage = await this.runtimeAuthorizationService.getUsage(
          customer.organizationId,
          applicationId,
          definition.key,
        );
        return {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          ...usage,
        };
      }),
    );
  }
}
