import { Controller, Get, Param } from "@nestjs/common";
import { CustomerUsageService } from "./customer-usage.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@Controller("customer-portal/customers/:customerId/usage")
export class CustomerUsageController {
  constructor(private readonly usageService: CustomerUsageService) {}

  @Get()
  async getUsage(@Param("customerId") customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usageService.getUsage(customerId, user.id);
  }
}
