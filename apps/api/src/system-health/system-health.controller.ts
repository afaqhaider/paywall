import { Controller, Get, NotFoundException, Param, UseGuards } from "@nestjs/common";
import { SystemHealthService } from "./system-health.service";
import { PlatformAdminGuard } from "../admin-directory/platform-admin.guard";

@UseGuards(PlatformAdminGuard)
@Controller("admin/system-health")
export class SystemHealthController {
  constructor(private readonly systemHealthService: SystemHealthService) {}

  @Get()
  async check() {
    return this.systemHealthService.check();
  }

  @Get(":providerName")
  async checkOne(@Param("providerName") providerName: string) {
    const result = await this.systemHealthService.checkOne(providerName);
    if (!result) {
      throw new NotFoundException(`No health provider named "${providerName}"`);
    }
    return result;
  }
}
