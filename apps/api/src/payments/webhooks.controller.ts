import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { OrganizationRole } from "@prisma/client";
import { WebhooksService } from "./webhooks.service";
import { Public } from "../common/decorators/public.decorator";
import { RequireOrgRole } from "../common/decorators/require-org-role.decorator";
import { OrganizationRoleGuard } from "../common/guards/organization-role.guard";

/**
 * The inbound endpoint every adapter's webhook points at. Public (no JWT) -
 * the caller is the payment provider itself, authenticated instead by
 * `adapter.verifyWebhook`'s signature check inside `WebhooksService`.
 */
@Public()
@Controller("webhooks/payments")
export class WebhookIngestController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post(":providerId")
  @HttpCode(HttpStatus.OK)
  async receive(@Param("providerId") providerId: string, @Req() req: RawBodyRequest<Request>) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.webhooksService.handleIncoming(providerId, rawBody, req.headers);
  }
}

@UseGuards(OrganizationRoleGuard)
@Controller("organizations/:organizationId/payment-webhooks")
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @RequireOrgRole(OrganizationRole.VIEWER)
  @Get()
  async list(
    @Param("organizationId") organizationId: string,
    @Query("providerId") providerId: string | undefined,
  ) {
    return this.webhooksService.list(organizationId, providerId);
  }
}
