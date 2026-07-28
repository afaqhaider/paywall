import { randomUUID } from "crypto";
import { ForbiddenException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DevicePlatform, DeviceStatus, LicenseType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { ApplicationsService } from "../applications/applications.service";
import { DevicesService } from "./devices.service";

describe("DevicesService (integration)", () => {
  const prisma = new PrismaService();
  const auditService = new AuditService(prisma);
  const organizationsService = new OrganizationsService(prisma, auditService);
  const applicationsService = new ApplicationsService(prisma, auditService);
  const devicesService = new DevicesService(prisma, auditService);

  const suffix = randomUUID();
  const meta = { ipAddress: "127.0.0.1", userAgent: "vitest" };
  let ownerId: string;
  let organizationId: string;
  let applicationId: string;
  let licenseId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const owner = await prisma.user.create({
      data: { email: `dev-owner-${suffix}@devtest.local`, passwordHash: "not-a-real-hash" },
    });
    ownerId = owner.id;

    const org = await organizationsService.create(owner.id, { name: `Device Org ${suffix}` }, meta);
    organizationId = org.id;

    const app = await applicationsService.create(
      org.id,
      owner.id,
      { name: `Device App ${suffix}` },
      meta,
    );
    applicationId = app.id;

    const license = await prisma.license.create({
      data: {
        organizationId,
        applicationId,
        type: LicenseType.DEVICE,
        deviceLimit: 2,
        createdById: ownerId,
      },
    });
    licenseId = license.id;
  });

  afterAll(async () => {
    await prisma.license.deleteMany({ where: { id: licenseId } });
    await prisma.application.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.organization.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.$disconnect();
  });

  it("re-registering an existing device updates it instead of erroring, even at capacity", async () => {
    await devicesService.register(
      organizationId,
      applicationId,
      { deviceId: `device-a-${suffix}`, platform: DevicePlatform.IOS, licenseId },
      ownerId,
      meta,
    );
    await devicesService.register(
      organizationId,
      applicationId,
      { deviceId: `device-b-${suffix}`, platform: DevicePlatform.ANDROID, licenseId },
      ownerId,
      meta,
    );

    // License is now at its deviceLimit of 2. Re-registering device-a (same
    // applicationId+deviceId) must succeed and just refresh its fields.
    const reRegistered = await devicesService.register(
      organizationId,
      applicationId,
      {
        deviceId: `device-a-${suffix}`,
        platform: DevicePlatform.IOS,
        licenseId,
        appVersion: "2.0.0",
      },
      ownerId,
      meta,
    );
    expect(reRegistered.appVersion).toBe("2.0.0");
    expect(reRegistered.status).toBe(DeviceStatus.ACTIVE);

    const activeCount = await prisma.deviceRegistration.count({
      where: { licenseId, status: DeviceStatus.ACTIVE },
    });
    expect(activeCount).toBe(2);
  });

  it("rejects registering a brand-new device once the license's deviceLimit is reached", async () => {
    await expect(
      devicesService.register(
        organizationId,
        applicationId,
        { deviceId: `device-c-${suffix}`, platform: DevicePlatform.WEB, licenseId },
        ownerId,
        meta,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const newDevice = await prisma.deviceRegistration.findUnique({
      where: { applicationId_deviceId: { applicationId, deviceId: `device-c-${suffix}` } },
    });
    expect(newDevice).toBeNull();
  });
});
