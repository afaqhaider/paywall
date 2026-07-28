import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminDirectoryService } from "./admin-directory.service";
import { AdminListQueryDto } from "./dto/admin-list-query.dto";
import { PlatformAdminGuard } from "./platform-admin.guard";

@UseGuards(PlatformAdminGuard)
@Controller("admin/api-keys")
export class AdminApiKeysController {
  constructor(private readonly adminDirectoryService: AdminDirectoryService) {}

  @Get()
  async list(@Query() query: AdminListQueryDto) {
    return this.adminDirectoryService.apiKeys(query);
  }
}
