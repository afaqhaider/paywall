import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { ApplicationMemberRole } from "@prisma/client";
import { WebhookEndpointsService } from "./webhook-endpoints.service";
import { CreateWebhookEndpointDto } from "./dto/create-webhook-endpoint.dto";
import { UpdateWebhookEndpointDto } from "./dto/update-webhook-endpoint.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireAppRole } from "../common/decorators/require-app-role.decorator";
import { ApplicationRoleGuard } from "../common/guards/application-role.guard";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@UseGuards(ApplicationRoleGuard)
@Controller("applications/:applicationId/webhook-endpoints")
export class WebhookEndpointsController {
  constructor(private readonly webhookEndpointsService: WebhookEndpointsService) {}

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Post()
  async create(
    @Param("applicationId") applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWebhookEndpointDto,
    @Req() req: Request,
  ) {
    return this.webhookEndpointsService.create(
      applicationId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get()
  async list(@Param("applicationId") applicationId: string) {
    return this.webhookEndpointsService.list(applicationId);
  }

  @RequireAppRole(ApplicationMemberRole.VIEWER)
  @Get(":webhookEndpointId")
  async getOne(
    @Param("applicationId") applicationId: string,
    @Param("webhookEndpointId") webhookEndpointId: string,
  ) {
    return this.webhookEndpointsService.getOne(applicationId, webhookEndpointId);
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Patch(":webhookEndpointId")
  async update(
    @Param("applicationId") applicationId: string,
    @Param("webhookEndpointId") webhookEndpointId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWebhookEndpointDto,
    @Req() req: Request,
  ) {
    return this.webhookEndpointsService.update(
      applicationId,
      webhookEndpointId,
      user.id,
      dto,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Post(":webhookEndpointId/disable")
  async disable(
    @Param("applicationId") applicationId: string,
    @Param("webhookEndpointId") webhookEndpointId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.webhookEndpointsService.disable(
      applicationId,
      webhookEndpointId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.DEVELOPER)
  @Post(":webhookEndpointId/enable")
  async enable(
    @Param("applicationId") applicationId: string,
    @Param("webhookEndpointId") webhookEndpointId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.webhookEndpointsService.enable(
      applicationId,
      webhookEndpointId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Delete(":webhookEndpointId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("applicationId") applicationId: string,
    @Param("webhookEndpointId") webhookEndpointId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.webhookEndpointsService.remove(
      applicationId,
      webhookEndpointId,
      user.id,
      extractRequestMeta(req),
    );
  }

  @RequireAppRole(ApplicationMemberRole.ADMINISTRATOR)
  @Post(":webhookEndpointId/secret/rotate")
  async rotateSecret(
    @Param("applicationId") applicationId: string,
    @Param("webhookEndpointId") webhookEndpointId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.webhookEndpointsService.rotateSecret(
      applicationId,
      webhookEndpointId,
      user.id,
      extractRequestMeta(req),
    );
  }
}
