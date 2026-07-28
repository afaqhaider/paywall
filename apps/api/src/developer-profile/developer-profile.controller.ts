import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import { DeveloperProfileService } from "./developer-profile.service";
import { UpdateDeveloperProfileDto } from "./dto/update-developer-profile.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@Controller("developer-profile")
export class DeveloperProfileController {
  constructor(private readonly developerProfileService: DeveloperProfileService) {}

  @Get()
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.developerProfileService.getOrCreate(user.id);
  }

  @Patch()
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDeveloperProfileDto,
    @Req() req: Request,
  ) {
    return this.developerProfileService.update(user.id, dto, extractRequestMeta(req));
  }
}
