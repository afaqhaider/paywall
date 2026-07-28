import { Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ApplicationMemberRole } from "@prisma/client";
import { WebhookDeliveriesService } from "./webhook-deliveries.service";
import { ListWebhookDeliveriesQueryDto } from "./dto/list-webhook-deliveries-query.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationScopedGuard } from "../common/guards/application-scoped.guard";
import { PrismaService } from "../prisma/prisma.service";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(
  ApplicationScopedGuard("webhookEndpointId", async (prisma: PrismaService, id: string) => {
    const row = await prisma.webhookEndpoint.findUnique({
      where: { id },
      select: { applicationId: true },
    });
    return row?.applicationId ?? null;
  }),
)
@Controller("webhook-endpoints/:webhookEndpointId/deliveries")
export class WebhookDeliveriesController {
  constructor(private readonly webhookDeliveriesService: WebhookDeliveriesService) {}

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(
    @Param("webhookEndpointId") webhookEndpointId: string,
    @Query() query: ListWebhookDeliveriesQueryDto,
  ) {
    return this.webhookDeliveriesService.list(webhookEndpointId, query);
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get(":deliveryId")
  async getOne(
    @Param("webhookEndpointId") webhookEndpointId: string,
    @Param("deliveryId") deliveryId: string,
  ) {
    return this.webhookDeliveriesService.getOne(webhookEndpointId, deliveryId);
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Post(":deliveryId/retry")
  async retry(
    @Param("webhookEndpointId") webhookEndpointId: string,
    @Param("deliveryId") deliveryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.webhookDeliveriesService.retry(
      webhookEndpointId,
      deliveryId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
