import { randomUUID } from "crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrganizationRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "./organizations.service";

describe("OrganizationsService (integration)", () => {
  const prisma = new PrismaService();
  const auditService = new AuditService(prisma);
  const organizationsService = new OrganizationsService(prisma, auditService);

  const suffix = randomUUID();
  const meta = { ipAddress: "127.0.0.1", userAgent: "vitest" };

  async function createUser(prefix: string) {
    return prisma.user.create({
      data: { email: `${prefix}-${suffix}@orgtest.local`, passwordHash: "not-a-real-hash" },
    });
  }

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.$disconnect();
  });

  it("creates an organization and makes the creator OWNER", async () => {
    const owner = await createUser("owner");
    const org = await organizationsService.create(owner.id, { name: `Acme ${suffix}` }, meta);

    const members = await organizationsService.listMembers(org.id);
    expect(members).toHaveLength(1);
    expect(members[0]?.role).toBe(OrganizationRole.OWNER);
    expect(members[0]?.user.id).toBe(owner.id);
  });

  it("generates unique slugs for organizations with the same name", async () => {
    const owner = await createUser("dupe-owner");
    const orgA = await organizationsService.create(owner.id, { name: `Dupe ${suffix}` }, meta);
    const orgB = await organizationsService.create(owner.id, { name: `Dupe ${suffix}` }, meta);

    expect(orgA.slug).not.toBe(orgB.slug);
  });

  it("prevents removing the last owner", async () => {
    const owner = await createUser("lastowner");
    const org = await organizationsService.create(owner.id, { name: `Solo ${suffix}` }, meta);
    const [membership] = await organizationsService.listMembers(org.id);

    await expect(
      organizationsService.removeMember(org.id, membership!.membershipId, owner.id, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("prevents demoting the last owner", async () => {
    const owner = await createUser("lastowner-demote");
    const org = await organizationsService.create(owner.id, { name: `SoloDemote ${suffix}` }, meta);
    const [membership] = await organizationsService.listMembers(org.id);

    await expect(
      organizationsService.updateMemberRole(
        org.id,
        membership!.membershipId,
        { role: OrganizationRole.ADMINISTRATOR },
        owner.id,
        meta,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows removing an owner when another owner remains", async () => {
    const ownerA = await createUser("multi-owner-a");
    const ownerB = await createUser("multi-owner-b");
    const org = await organizationsService.create(ownerA.id, { name: `Multi ${suffix}` }, meta);
    await organizationsService.addMember(
      org.id,
      { email: ownerB.email, role: OrganizationRole.OWNER },
      ownerA.id,
      meta,
    );

    const members = await organizationsService.listMembers(org.id);
    const ownerAMembership = members.find((m) => m.user.id === ownerA.id)!;

    await expect(
      organizationsService.removeMember(org.id, ownerAMembership.membershipId, ownerB.id, meta),
    ).resolves.toBeUndefined();

    const remaining = await organizationsService.listMembers(org.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.user.id).toBe(ownerB.id);
  });

  it("only an existing owner can grant the OWNER role", async () => {
    const owner = await createUser("grant-owner");
    const admin = await createUser("grant-admin");
    const outsider = await createUser("grant-target");
    const org = await organizationsService.create(owner.id, { name: `Grant ${suffix}` }, meta);
    await organizationsService.addMember(
      org.id,
      { email: admin.email, role: OrganizationRole.ADMINISTRATOR },
      owner.id,
      meta,
    );

    await expect(
      organizationsService.addMember(
        org.id,
        { email: outsider.email, role: OrganizationRole.OWNER },
        admin.id,
        meta,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      organizationsService.addMember(
        org.id,
        { email: outsider.email, role: OrganizationRole.OWNER },
        owner.id,
        meta,
      ),
    ).resolves.toBeDefined();
  });
});
