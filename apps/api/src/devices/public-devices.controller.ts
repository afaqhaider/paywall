import { BadRequestException, Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { ApiKeyGuard, type ApiKeyAuthenticatedRequest } from "../common/guards/api-key.guard";
import { Public } from "../common/decorators/public.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import { ApiKeySystemActorService } from "../common/services/api-key-system-actor.service";
import { DevicesService } from "./devices.service";
import { RegisterDeviceDto } from "./dto/register-device.dto";

/**
 * API-key-authenticated device registration - the machine-to-machine
 * counterpart to `DevicesController` (which is dashboard-JWT + org-role
 * gated for a human managing devices from the web app). An integrating
 * app's own backend calls this at runtime when one of its end users' devices
 * checks in, using the audit actor from `ApiKeySystemActorService` since
 * there's no dashboard user in this flow. Reuses `DevicesService.register`
 * unchanged - upsert-on-(applicationId, deviceId) semantics, device-limit
 * enforcement, and audit logging all stay identical to the dashboard path.
 */
@Public()
@UseGuards(ApiKeyGuard)
@Controller("public/devices")
export class PublicDevicesController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly systemActor: ApiKeySystemActorService,
  ) {}

  @Post()
  async register(@Body() dto: RegisterDeviceDto, @Req() req: ApiKeyAuthenticatedRequest & Request) {
    const { organizationId, applicationId } = req.apiKeyContext;
    if (!applicationId) {
      throw new BadRequestException(
        "This API key is not scoped to a single application - device registration requires an application-scoped key",
      );
    }
    const actorUserId = await this.systemActor.getSystemUserId();
    return this.devicesService.register(
      organizationId,
      applicationId,
      dto,
      actorUserId,
      extractRequestMeta(req),
    );
  }
}
