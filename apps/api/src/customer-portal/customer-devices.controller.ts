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
} from "@nestjs/common";
import type { Request } from "express";
import { CustomerDevicesService } from "./customer-devices.service";
import { RenameDeviceDto } from "./dto/rename-device.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { extractRequestMeta } from "../common/utils/request-meta.util";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

@Controller("customer-portal/customers/:customerId/devices")
export class CustomerDevicesController {
  constructor(private readonly devicesService: CustomerDevicesService) {}

  @Get()
  async list(@Param("customerId") customerId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.devicesService.list(customerId, user.id);
  }

  @Patch(":deviceId")
  async rename(
    @Param("customerId") customerId: string,
    @Param("deviceId") deviceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RenameDeviceDto,
    @Req() req: Request,
  ) {
    return this.devicesService.rename(customerId, deviceId, user.id, dto, extractRequestMeta(req));
  }

  @Post(":deviceId/deactivate")
  async deactivate(
    @Param("customerId") customerId: string,
    @Param("deviceId") deviceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.devicesService.deactivate(customerId, deviceId, user.id, extractRequestMeta(req));
  }

  @Delete(":deviceId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("customerId") customerId: string,
    @Param("deviceId") deviceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    await this.devicesService.remove(customerId, deviceId, user.id, extractRequestMeta(req));
  }
}
