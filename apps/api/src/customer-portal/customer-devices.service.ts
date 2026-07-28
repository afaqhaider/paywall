import { Injectable, NotFoundException } from "@nestjs/common";
import { DeviceStatus, type DeviceRegistration } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import { CustomerOwnershipService } from "./customer-ownership.service";
import type { RenameDeviceDto } from "./dto/rename-device.dto";

@Injectable()
export class CustomerDevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ownership: CustomerOwnershipService,
  ) {}

  /** `DeviceRegistration` has no `customerId` - devices belong to the customer's underlying `User` (`userId`), never the `Customer` row directly. */
  async list(customerId: string, userId: string) {
    const customer = await this.ownership.loadOwnedCustomer(customerId, userId);
    if (!customer.userId) return [];

    return this.prisma.deviceRegistration.findMany({
      where: { userId: customer.userId },
      orderBy: { lastSeenAt: "desc" },
    });
  }

  async rename(
    customerId: string,
    deviceId: string,
    userId: string,
    dto: RenameDeviceDto,
    meta: RequestMeta,
  ) {
    const customer = await this.ownership.loadOwnedCustomer(customerId, userId);
    await this.getOwnedDevice(deviceId, customer.userId);

    const updated = await this.prisma.deviceRegistration.update({
      where: { id: deviceId },
      data: { name: dto.name },
    });

    await this.auditService.record({
      action: "DEVICE_RENAMED",
      userId,
      organizationId: customer.organizationId,
      metadata: { deviceRegistrationId: deviceId, name: dto.name },
      ...meta,
    });

    return updated;
  }

  async deactivate(customerId: string, deviceId: string, userId: string, meta: RequestMeta) {
    const customer = await this.ownership.loadOwnedCustomer(customerId, userId);
    await this.getOwnedDevice(deviceId, customer.userId);

    const updated = await this.prisma.deviceRegistration.update({
      where: { id: deviceId },
      data: { status: DeviceStatus.INACTIVE },
    });

    await this.auditService.record({
      action: "DEVICE_DEACTIVATED",
      userId,
      organizationId: customer.organizationId,
      metadata: { deviceRegistrationId: deviceId },
      ...meta,
    });

    return updated;
  }

  /** Soft-removes (never hard-deletes) so device history stays reconstructable - `REMOVED` is a new `DeviceStatus` value added specifically for this. */
  async remove(customerId: string, deviceId: string, userId: string, meta: RequestMeta) {
    const customer = await this.ownership.loadOwnedCustomer(customerId, userId);
    await this.getOwnedDevice(deviceId, customer.userId);

    await this.prisma.deviceRegistration.update({
      where: { id: deviceId },
      data: { status: DeviceStatus.REMOVED },
    });

    await this.auditService.record({
      action: "DEVICE_REMOVED",
      userId,
      organizationId: customer.organizationId,
      metadata: { deviceRegistrationId: deviceId },
      ...meta,
    });
  }

  private async getOwnedDevice(
    deviceId: string,
    ownerUserId: string | null,
  ): Promise<DeviceRegistration> {
    const device = await this.prisma.deviceRegistration.findUnique({ where: { id: deviceId } });
    if (!device || !ownerUserId || device.userId !== ownerUserId) {
      throw new NotFoundException("Device not found");
    }
    return device;
  }
}
