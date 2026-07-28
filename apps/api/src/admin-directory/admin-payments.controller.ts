import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminDirectoryService } from "./admin-directory.service";
import { AdminPaymentListQueryDto } from "./dto/admin-list-query.dto";
import { PlatformAdminGuard } from "./platform-admin.guard";

@UseGuards(PlatformAdminGuard)
@Controller("admin/payments")
export class AdminPaymentsController {
  constructor(private readonly adminDirectoryService: AdminDirectoryService) {}

  @Get()
  async list(@Query() query: AdminPaymentListQueryDto) {
    return this.adminDirectoryService.payments(query);
  }
}
