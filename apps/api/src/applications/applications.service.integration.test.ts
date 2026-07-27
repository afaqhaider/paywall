import { randomUUID } from "crypto";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApplicationMemberRole, ApplicationVisibility, OrganizationRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { ApplicationsService } from "./applications.service";
import { ApplicationMembersService } from "./application-members.service";

describe("ApplicationsService (integration)", () => {
  const prisma = new PrismaService();
  const auditService = new AuditService(prisma);
  const organizationsService = new OrganizationsService(prisma, auditService);
  const applicationsService = new ApplicationsService(prisma, auditService);
  const membersService = new ApplicationMembersService(prisma, auditService);

  const suffix = randomUUID();
  const meta = { ipAddress: "127.0.0.1", userAgent: "vitest" };

  async function createUser(prefix: string) {
    return prisma.user.create({
      data: { email: `${prefix}-${suffix}@apptest.local`, passwordHash: "not-a-real-hash" },
    });
  }

  async function createOrgWithOwner(prefix: string) {
    const owner = await createUser(`${prefix}-owner`);
    const org = await organizationsService.create(
      owner.id,
      { name: `${prefix} Org ${suffix}` },
      meta,
    );
    return { owner, org };
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

  it("creates an application and makes the creator its OWNER member", async () => {
    const { owner, org } = await createOrgWithOwner("create");
    const app = await applicationsService.create(
      org.id,
      owner.id,
      { name: `Widget ${suffix}` },
      meta,
    );

    const members = await membersService.list(app.id);
    expect(members).toHaveLength(1);
    expect(members[0]?.role).toBe(ApplicationMemberRole.OWNER);
    expect(members[0]?.user.id).toBe(owner.id);
  });

  it("generates unique slugs for applications with the same name", async () => {
    const { owner, org } = await createOrgWithOwner("dupe");
    const a = await applicationsService.create(
      org.id,
      owner.id,
      { name: `Dupe App ${suffix}` },
      meta,
    );
    const b = await applicationsService.create(
      org.id,
      owner.id,
      { name: `Dupe App ${suffix}` },
      meta,
    );

    expect(a.slug).not.toBe(b.slug);
  });

  it("hides PRIVATE applications from org members who are not app members, but shows INTERNAL ones", async () => {
    const { owner, org } = await createOrgWithOwner("visibility");
    const viewer = await createUser("visibility-viewer");
    await organizationsService.addMember(
      org.id,
      { email: viewer.email, role: OrganizationRole.MEMBER },
      owner.id,
      meta,
    );

    const privateApp = await applicationsService.create(
      org.id,
      owner.id,
      { name: `Private ${suffix}`, visibility: ApplicationVisibility.PRIVATE },
      meta,
    );
    const internalApp = await applicationsService.create(
      org.id,
      owner.id,
      { name: `Internal ${suffix}`, visibility: ApplicationVisibility.INTERNAL },
      meta,
    );

    const result = await applicationsService.listForOrganization(org.id, viewer.id, {});
    const ids = result.items.map((a) => a.id);

    expect(ids).toContain(internalApp.id);
    expect(ids).not.toContain(privateApp.id);
  });

  it("lets an org ADMINISTRATOR see every application in the org regardless of visibility or membership", async () => {
    const { owner, org } = await createOrgWithOwner("admin-visibility");
    const admin = await createUser("admin-visibility-admin");
    await organizationsService.addMember(
      org.id,
      { email: admin.email, role: OrganizationRole.ADMINISTRATOR },
      owner.id,
      meta,
    );

    const privateApp = await applicationsService.create(
      org.id,
      owner.id,
      { name: `AdminPriv ${suffix}` },
      meta,
    );

    const result = await applicationsService.listForOrganization(org.id, admin.id, {});
    expect(result.items.map((a) => a.id)).toContain(privateApp.id);
  });

  it("prevents removing the last application owner", async () => {
    const { owner, org } = await createOrgWithOwner("lastowner");
    const app = await applicationsService.create(
      org.id,
      owner.id,
      { name: `Solo ${suffix}` },
      meta,
    );
    const [membership] = await membersService.list(app.id);

    await expect(
      membersService.remove(app.id, membership!.membershipId, owner.id, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("prevents demoting the last application owner", async () => {
    const { owner, org } = await createOrgWithOwner("lastowner-demote");
    const app = await applicationsService.create(
      org.id,
      owner.id,
      { name: `SoloDemote ${suffix}` },
      meta,
    );
    const [membership] = await membersService.list(app.id);

    await expect(
      membersService.updateRole(
        app.id,
        membership!.membershipId,
        { role: ApplicationMemberRole.ADMINISTRATOR },
        owner.id,
        meta,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("only an existing application owner (or the org's owner/administrator) can grant the OWNER role", async () => {
    const { owner, org } = await createOrgWithOwner("grant");
    const appAdmin = await createUser("grant-app-admin");
    const outsider = await createUser("grant-target");
    const app = await applicationsService.create(
      org.id,
      owner.id,
      { name: `Grant ${suffix}` },
      meta,
    );

    await membersService.add(
      app.id,
      { email: appAdmin.email, role: ApplicationMemberRole.ADMINISTRATOR },
      owner.id,
      meta,
    );

    await expect(
      membersService.add(
        app.id,
        { email: outsider.email, role: ApplicationMemberRole.OWNER },
        appAdmin.id,
        meta,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      membersService.add(
        app.id,
        { email: outsider.email, role: ApplicationMemberRole.OWNER },
        owner.id,
        meta,
      ),
    ).resolves.toBeDefined();
  });

  it("archiving and restoring an application updates status and archivedAt", async () => {
    const { owner, org } = await createOrgWithOwner("archive");
    const app = await applicationsService.create(
      org.id,
      owner.id,
      { name: `Archive ${suffix}` },
      meta,
    );

    const archived = await applicationsService.archive(app.id, org.id, owner.id, meta);
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.archivedAt).not.toBeNull();

    const restored = await applicationsService.restore(app.id, org.id, owner.id, meta);
    expect(restored.status).toBe("ACTIVE");
    expect(restored.archivedAt).toBeNull();
  });
});
