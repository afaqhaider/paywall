import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApplicationMemberRole } from "@prisma/client";
import { SdkConfigService } from "./sdk-config.service";
import { SdkConfigQueryDto } from "./dto/sdk-config-query.dto";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/sdk-config")
export class SdkConfigController {
  constructor(private readonly sdkConfigService: SdkConfigService) {}

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get(":platform")
  async get(
    @Param("applicationId") applicationId: string,
    @Param("platform") platform: string,
    @Query() query: SdkConfigQueryDto,
  ) {
    return this.sdkConfigService.generate(applicationId, platform, query.environmentId);
  }
}
