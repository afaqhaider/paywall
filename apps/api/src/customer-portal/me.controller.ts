import { Body, Controller, Get, Patch, Req } from "@nestjs/common";
import type { Request } from "express";
import { MeCustomersService } from "./me-customers.service";
import { ProfileService } from "../profile/profile.service";
import { UpdateProfileDto } from "../profile/dto/update-profile.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@Controller("customer-portal/me")
export class MeController {
  constructor(
    private readonly meCustomersService: MeCustomersService,
    private readonly profileService: ProfileService,
  ) {}

  @Get("customers")
  async listCustomers(@CurrentUser() user: AuthenticatedUser) {
    return this.meCustomersService.listForUser(user.id);
  }

  /**
   * The Customer Portal's "Settings" page is conceptually the same `User`
   * profile fields the Developer Portal already edits - this delegates
   * straight to the existing `ProfileService` rather than duplicating
   * user-preference storage.
   */
  @Get("settings")
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getProfile(user.id);
  }

  @Patch("settings")
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    return this.profileService.updateProfile(user.id, dto, extractRequestMeta(req));
  }
}
