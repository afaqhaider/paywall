import { randomUUID } from "crypto";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../common/utils/password.util";

/**
 * HTTP-level coverage for the App Registry: the full success path from the
 * spec, the cross-organization isolation guarantee, the app permission
 * matrix, and the org-admin override - all things that only exercise
 * correctly through the real guards, not by calling services directly.
 */
describe("Applications (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = randomUUID();

  function authed(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  // Creates the user directly (bypassing /auth/register's 5-per-minute
  // throttle - this file logs in far more than 5 distinct users, which is
  // an artifact of testing many scenarios in one file, not a login-flow
  // concern) but still logs in through the real HTTP endpoint so guards
  // are exercised against a genuine access token.
  async function registerAndLogin(prefix: string) {
    const email = `${prefix}-${suffix}@appregistrytest.local`;
    const password = "SuperSecret123!";
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password })
      .expect(200);
    return { email, accessToken: loginRes.body.accessToken as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Organizations cascade-delete their applications (and every
    // application sub-resource); only after that is it safe to delete the
    // users, since Application.createdById has no cascade/set-null of its
    // own (deleting a user who created an application is restricted).
    await prisma.organization.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await app.close();
  });

  it("walks the full success path: org -> app -> member -> version -> domain -> setting -> secret", async () => {
    const owner = await registerAndLogin("success-owner");
    const memberUser = await registerAndLogin("success-member");

    const orgRes = await request(app.getHttpServer())
      .post("/organizations")
      .set(authed(owner.accessToken))
      .send({ name: `Success Org ${suffix}` })
      .expect(201);
    const organizationId = orgRes.body.id as string;

    const appRes = await request(app.getHttpServer())
      .post(`/organizations/${organizationId}/applications`)
      .set(authed(owner.accessToken))
      .send({ name: `Success App ${suffix}` })
      .expect(201);
    const applicationId = appRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/applications/${applicationId}/members`)
      .set(authed(owner.accessToken))
      .send({ email: memberUser.email, role: "DEVELOPER" })
      .expect(201);

    const versionRes = await request(app.getHttpServer())
      .post(`/applications/${applicationId}/versions`)
      .set(authed(owner.accessToken))
      .send({ androidVersion: "1.0.0", track: "stable" })
      .expect(201);
    expect(versionRes.body.isLatest).toBe(true);

    await request(app.getHttpServer())
      .post(`/applications/${applicationId}/domains`)
      .set(authed(owner.accessToken))
      .send({ domain: `app-${suffix.replace(/-/g, "")}.example.com`, isPrimary: true })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/applications/${applicationId}/settings/maintenanceMode`)
      .set(authed(owner.accessToken))
      .send({ value: false })
      .expect(200);

    const secretRes = await request(app.getHttpServer())
      .post(`/applications/${applicationId}/secrets`)
      .set(authed(owner.accessToken))
      .send({ type: "API_KEY", key: "STRIPE_KEY", value: "sk_live_abcdef123456" })
      .expect(201);

    expect(JSON.stringify(secretRes.body)).not.toContain("sk_live_abcdef123456");
    expect(secretRes.body).not.toHaveProperty("encryptedValue");
    expect(secretRes.body).not.toHaveProperty("iv");
    expect(secretRes.body).not.toHaveProperty("authTag");
    expect(secretRes.body.lastFour).toBe("3456");
  });

  it("prevents reaching an application through the wrong organization's URL (cross-org isolation)", async () => {
    const ownerA = await registerAndLogin("iso-owner-a");
    const ownerB = await registerAndLogin("iso-owner-b");

    const orgARes = await request(app.getHttpServer())
      .post("/organizations")
      .set(authed(ownerA.accessToken))
      .send({ name: `Iso Org A ${suffix}` })
      .expect(201);
    const orgBRes = await request(app.getHttpServer())
      .post("/organizations")
      .set(authed(ownerB.accessToken))
      .send({ name: `Iso Org B ${suffix}` })
      .expect(201);

    const appRes = await request(app.getHttpServer())
      .post(`/organizations/${orgARes.body.id}/applications`)
      .set(authed(ownerA.accessToken))
      .send({ name: `Iso App ${suffix}` })
      .expect(201);

    // Org B's owner has no membership in org A or the app - reaching the
    // app through org B's URL must 404, not merely 403.
    await request(app.getHttpServer())
      .get(`/organizations/${orgBRes.body.id}/applications/${appRes.body.id}`)
      .set(authed(ownerB.accessToken))
      .expect(404);

    // Even org A's own OWNER can't reach their app through org B's URL.
    await request(app.getHttpServer())
      .get(`/organizations/${orgBRes.body.id}/applications/${appRes.body.id}`)
      .set(authed(ownerA.accessToken))
      .expect(404);

    // The correct URL still works.
    await request(app.getHttpServer())
      .get(`/organizations/${orgARes.body.id}/applications/${appRes.body.id}`)
      .set(authed(ownerA.accessToken))
      .expect(200);
  });

  it("enforces the application permission matrix: VIEWER can read but not write", async () => {
    const owner = await registerAndLogin("perm-owner");
    const viewer = await registerAndLogin("perm-viewer");

    const orgRes = await request(app.getHttpServer())
      .post("/organizations")
      .set(authed(owner.accessToken))
      .send({ name: `Perm Org ${suffix}` })
      .expect(201);
    const appRes = await request(app.getHttpServer())
      .post(`/organizations/${orgRes.body.id}/applications`)
      .set(authed(owner.accessToken))
      .send({ name: `Perm App ${suffix}` })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/applications/${appRes.body.id}/members`)
      .set(authed(owner.accessToken))
      .send({ email: viewer.email, role: "VIEWER" })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/applications/${appRes.body.id}/versions`)
      .set(authed(viewer.accessToken))
      .expect(200);

    await request(app.getHttpServer())
      .post(`/applications/${appRes.body.id}/versions`)
      .set(authed(viewer.accessToken))
      .send({ androidVersion: "9.9.9" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/applications/${appRes.body.id}/secrets`)
      .set(authed(viewer.accessToken))
      .send({ type: "API_KEY", key: "X", value: "y" })
      .expect(403);
  });

  it("grants an organization ADMINISTRATOR override access to an app they are not an explicit member of", async () => {
    const owner = await registerAndLogin("override-owner");
    const admin = await registerAndLogin("override-admin");

    const orgRes = await request(app.getHttpServer())
      .post("/organizations")
      .set(authed(owner.accessToken))
      .send({ name: `Override Org ${suffix}` })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/organizations/${orgRes.body.id}/members`)
      .set(authed(owner.accessToken))
      .send({ email: admin.email, role: "ADMINISTRATOR" })
      .expect(201);

    const appRes = await request(app.getHttpServer())
      .post(`/organizations/${orgRes.body.id}/applications`)
      .set(authed(owner.accessToken))
      .send({ name: `Override App ${suffix}`, visibility: "PRIVATE" })
      .expect(201);

    // The org ADMINISTRATOR was never added as an ApplicationMember, but
    // should still be able to manage the app via the org-level override.
    await request(app.getHttpServer())
      .patch(`/organizations/${orgRes.body.id}/applications/${appRes.body.id}`)
      .set(authed(admin.accessToken))
      .send({ description: "updated by org admin" })
      .expect(200);
  });
});
