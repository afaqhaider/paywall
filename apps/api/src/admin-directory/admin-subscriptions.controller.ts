import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminDirectoryService } from "./admin-directory.service";
import { AdminSubscriptionListQueryDto } from "./dto/admin-list-query.dto";
import { PlatformAdminGuard } from "./platform-admin.guard";

@UseGuards(PlatformAdminGuard)
@Controller("admin/subscriptions")
export class AdminSubscriptionsController {
  constructor(private readonly adminDirectoryService: AdminDirectoryService) {}

  @Get()
  async list(@Query() query: AdminSubscriptionListQueryDto) {
    return this.adminDirectoryService.subscriptions(query);
  }
}
