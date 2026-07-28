import { Controller, Get, Param } from "@nestjs/common";
import { CustomerDashboardService } from "./customer-dashboard.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@Controller("customer-portal/customers/:customerId")
export class CustomerDashboardController {
  constructor(private readonly dashboardService: CustomerDashboardService) {}

  @Get("dashboard")
  async getDashboard(
    @Param("customerId") customerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getSummary(customerId, user.id);
  }
}
