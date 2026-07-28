import { Controller, Get, Param } from "@nestjs/common";
import { CustomerLicensesService } from "./customer-licenses.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@Controller("customer-portal/customers/:customerId/licenses")
export class CustomerLicensesController {
  constructor(private readonly licensesService: CustomerLicensesService) {}

  @Get()
  async list(@Param("customerId") customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.licensesService.list(customerId, user.id);
  }
}
