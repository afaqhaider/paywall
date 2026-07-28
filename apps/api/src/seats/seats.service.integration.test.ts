import { randomUUID } from "crypto";
import { ConflictException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LicenseType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { ApplicationsService } from "../applications/applications.service";
import { LicensesService } from "../licenses/licenses.service";
import { SeatsService } from "./seats.service";

/**
 * The core safety invariant for the Seats module: a SEAT-type License must
 * never end up with more ACTIVE SeatAssignments than seats that physically
 * exist for it, and seat creation must never exceed `License.seatLimit`.
 * Both the bulk-create cap and the assignment compare-and-swap in
 * SeatsService exist to guarantee this even under concurrent requests.
 */
describe("SeatsService (integration) - seat over-allocation prevention", () => {
  const prisma = new PrismaService();
  const auditService = new AuditService(prisma);
  const organizationsService = new OrganizationsService(prisma, auditService);
  const applicationsService = new ApplicationsService(prisma, auditService);
  const licensesService = new LicensesService(prisma, auditService);
  const seatsService = new SeatsService(prisma, auditService);

  const suffix = randomUUID();
  const meta = { ipAddress: "127.0.0.1", userAgent: "vitest" };

  async function createUser(prefix: string) {
    return prisma.user.create({
      data: { email: `${prefix}-${suffix}@seattest.local`, passwordHash: "not-a-real-hash" },
    });
  }

  async function createOrgAppAndSeatLicense(prefix: string, seatLimit: number) {
    const owner = await createUser(`${prefix}-owner`);
    const org = await organizationsService.create(owner.id, { name: `${prefix} ${suffix}` }, meta);
    const app = await applicationsService.create(
      org.id,
      owner.id,
      { name: `${prefix} App ${suffix}` },
      meta,
    );
    const license = await licensesService.create(
      org.id,
      owner.id,
      { applicationId: app.id, type: LicenseType.SEAT, seatLimit },
      meta,
    );
    return { owner, org, app, license };
  }

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.application.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.organization.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.$disconnect();
  });

  it("refuses to create more seats than the license's seatLimit allows", async () => {
    const { owner, org, license } = await createOrgAppAndSeatLicense("cap", 2);

    await expect(
      seatsService.bulkCreate(license.id, org.id, owner.id, { count: 3 }, meta),
    ).rejects.toThrow(/exceed this license's seat limit/);

    const seatCount = await prisma.seat.count({ where: { licenseId: license.id } });
    expect(seatCount).toBe(0);
  });

  it("never assigns the same seat to two users under concurrent requests", async () => {
    const { owner, org, license } = await createOrgAppAndSeatLicense("race", 1);
    await seatsService.bulkCreate(license.id, org.id, owner.id, { count: 1 }, meta);

    const userA = await createUser("race-a");
    const userB = await createUser("race-b");

    const results = await Promise.allSettled([
      seatsService.assign(license.id, org.id, userA.id, { userId: userA.id }, meta),
      seatsService.assign(license.id, org.id, userB.id, { userId: userB.id }, meta),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

    const activeAssignments = await prisma.seatAssignment.count({
      where: { seat: { licenseId: license.id }, status: "ACTIVE" },
    });
    expect(activeAssignments).toBe(1);

    // A third assignment attempt against the now-fully-allocated license
    // must also be rejected, never silently over-allocate.
    const userC = await createUser("race-c");
    await expect(
      seatsService.assign(license.id, org.id, userC.id, { userId: userC.id }, meta),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
