import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DeviceStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { RegisterDeviceDto } from "./dto/register-device.dto";
import type { DeviceQueryDto } from "./dto/device-query.dto";

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Registers a device, upserting on the (applicationId, deviceId) unique
   * constraint so re-registering an already-known device updates its
   * liveness fields instead of erroring. The device-limit check only
   * applies when this is a genuinely *new* device row (an existing device
   * re-checking in must never be rejected just because the license is
   * already at capacity). The count-then-insert runs inside a Serializable
   * transaction so two concurrent registrations against the same
   * near-capacity license can't both slip past the check.
   */
  async register(
    organizationId: string,
    applicationId: string,
    dto: RegisterDeviceDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    await this.assertApplicationInOrg(organizationId, applicationId);
    if (dto.licenseId) {
      await this.assertLicenseInApplication(applicationId, dto.licenseId);
    }

    const device = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.deviceRegistration.findUnique({
          where: { applicationId_deviceId: { applicationId, deviceId: dto.deviceId } },
        });

        if (!existing && dto.licenseId) {
          const license = await tx.license.findUniqueOrThrow({ where: { id: dto.licenseId } });
          if (license.deviceLimit !== null) {
            const activeCount = await tx.deviceRegistration.count({
              where: { licenseId: dto.licenseId, status: DeviceStatus.ACTIVE },
            });
            if (activeCount >= license.deviceLimit) {
              throw new ForbiddenException(
                `Device limit (${license.deviceLimit}) reached for this license`,
              );
            }
          }
        }

        return tx.deviceRegistration.upsert({
          where: { applicationId_deviceId: { applicationId, deviceId: dto.deviceId } },
          create: {
            applicationId,
            organizationId,
            userId: dto.userId,
            licenseId: dto.licenseId,
            deviceId: dto.deviceId,
            platform: dto.platform,
            appVersion: dto.appVersion,
            osVersion: dto.osVersion,
            pushToken: dto.pushToken,
            lastSeenAt: new Date(),
          },
          update: {
            userId: dto.userId,
            licenseId: dto.licenseId,
            appVersion: dto.appVersion,
            osVersion: dto.osVersion,
            pushToken: dto.pushToken,
            lastSeenAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.auditService.record({
      action: "DEVICE_REGISTERED",
      userId: actorUserId,
      organizationId,
      applicationId,
      metadata: {
        deviceRegistrationId: device.id,
        deviceId: dto.deviceId,
        platform: dto.platform,
        ownerUserId: dto.userId,
        licenseId: dto.licenseId,
      },
      ...meta,
    });

    return device;
  }

  async list(organizationId: string, applicationId: string, query: DeviceQueryDto) {
    return this.prisma.deviceRegistration.findMany({
      where: {
        applicationId,
        organizationId,
        userId: query.userId,
        licenseId: query.licenseId,
      },
      orderBy: { lastSeenAt: "desc" },
    });
  }

  async getOne(organizationId: string, applicationId: string, deviceRegistrationId: string) {
    const device = await this.prisma.deviceRegistration.findUnique({
      where: { id: deviceRegistrationId },
    });
    if (
      !device ||
      device.applicationId !== applicationId ||
      (device.organizationId !== null && device.organizationId !== organizationId)
    ) {
      throw new NotFoundException("Device registration not found");
    }
    return device;
  }

  async revoke(
    organizationId: string,
    applicationId: string,
    deviceRegistrationId: string,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const device = await this.getOne(organizationId, applicationId, deviceRegistrationId);
    if (device.status === DeviceStatus.BLOCKED) {
      throw new BadRequestException("Device is already blocked");
    }

    const updated = await this.prisma.deviceRegistration.update({
      where: { id: deviceRegistrationId },
      data: { status: DeviceStatus.BLOCKED },
    });

    await this.auditService.record({
      action: "DEVICE_REVOKED",
      userId: actorUserId,
      organizationId,
      applicationId,
      metadata: { deviceRegistrationId },
      ...meta,
    });

    return updated;
  }

  private async assertApplicationInOrg(organizationId: string, applicationId: string) {
    const application = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!application || application.organizationId !== organizationId) {
      throw new NotFoundException("Application not found for this organization");
    }
  }

  private async assertLicenseInApplication(applicationId: string, licenseId: string) {
    const license = await this.prisma.license.findUnique({ where: { id: licenseId } });
    if (!license || license.applicationId !== applicationId) {
      throw new NotFoundException("License not found for this application");
    }
  }
}
