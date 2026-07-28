import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { TwoFactorService } from "./two-factor.service";
import { VerifyTwoFactorDto } from "./dto/verify-two-factor.dto";
import { DisableTwoFactorDto } from "./dto/disable-two-factor.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

/**
 * Per-User (not per-Customer) Security section of the Customer Portal:
 * two-factor setup/enable/disable plus the "Login Sessions" / "Trusted
 * Devices" / "Recent Activity" overview. No `:customerId` scoping needed
 * here - it's identity/account security, not customer-relationship data.
 */
@Controller("customer-portal/me/security")
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Get()
  async getSecurity(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.getSecurityOverview(user.id);
  }

  @Post("two-factor/setup")
  async setup(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.setup(user.id, user.email);
  }

  @Post("two-factor/verify")
  async verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyTwoFactorDto,
    @Req() req: Request,
  ) {
    return this.twoFactorService.verify(user.id, dto.code, extractRequestMeta(req));
  }

  @Post("two-factor/disable")
  async disable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisableTwoFactorDto,
    @Req() req: Request,
  ) {
    await this.twoFactorService.disable(user.id, dto.code, extractRequestMeta(req));
    return { message: "Two-factor authentication disabled." };
  }
}
