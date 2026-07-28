import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminFraudService } from "./admin-fraud.service";
import { CursorQueryDto } from "../common/dto/cursor-query.dto";
import { PlatformAdminGuard } from "../admin-shared/guards/platform-admin.guard";

/** Fraud/abuse detection via aggregation over existing tables - no new
 * models, reasonable hardcoded thresholds (see the named constants at the
 * top of `admin-fraud.service.ts`). */
@UseGuards(PlatformAdminGuard)
@Controller("admin/fraud")
export class AdminFraudController {
  constructor(private readonly adminFraudService: AdminFraudService) {}

  @Get("failed-payments")
  async failedPayments() {
    return this.adminFraudService.failedPayments();
  }

  @Get("suspicious-logins")
  async suspiciousLogins() {
    return this.adminFraudService.suspiciousLogins();
  }

  @Get("device-abuse")
  async deviceAbuse() {
    return this.adminFraudService.deviceAbuse();
  }

  @Get("api-abuse")
  async apiAbuse() {
    return this.adminFraudService.apiAbuse();
  }

  @Get("webhook-abuse")
  async webhookAbuse() {
    return this.adminFraudService.webhookAbuse();
  }

  @Get("excessive-trials")
  async excessiveTrials() {
    return this.adminFraudService.excessiveTrials();
  }

  @Get("chargebacks")
  async chargebacks(@Query() query: CursorQueryDto) {
    return this.adminFraudService.chargebacks(query);
  }
}
