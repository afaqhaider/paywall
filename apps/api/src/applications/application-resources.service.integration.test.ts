import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApplicationEnvironmentType, ApplicationSecretType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { ApplicationsService } from "./applications.service";
import { ApplicationVersionsService } from "./application-versions.service";
import { ApplicationEnvironmentsService } from "./application-environments.service";
import { ApplicationSecretsService } from "./application-secrets.service";
import { ApplicationDomainsService } from "./application-domains.service";
import { ApplicationSettingsService } from "./application-settings.service";

describe("Application sub-resources (integration)", () => {
  const prisma = new PrismaService();
  const auditService = new AuditService(prisma);
  const organizationsService = new OrganizationsService(prisma, auditService);
  const applicationsService = new ApplicationsService(prisma, auditService);
  const versionsService = new ApplicationVersionsService(prisma, auditService);
  const environmentsService = new ApplicationEnvironmentsService(prisma, auditService);
  const secretsService = new ApplicationSecretsService(prisma, auditService);
  const domainsService = new ApplicationDomainsService(prisma, auditService);
  const settingsService = new ApplicationSettingsService(prisma, auditService);

  const suffix = randomUUID();
  const meta = { ipAddress: "127.0.0.1", userAgent: "vitest" };
  let ownerId: string;
  let applicationId: string;

  beforeAll(async () => {
    await prisma.$connect();
    process.env.APP_SECRET_ENCRYPTION_KEY ??= Buffer.alloc(32, 9).toString("base64");

    const owner = await prisma.user.create({
      data: { email: `subres-owner-${suffix}@apptest.local`, passwordHash: "not-a-real-hash" },
    });
    ownerId = owner.id;

    const org = await organizationsService.create(owner.id, { name: `SubRes Org ${suffix}` }, meta);
    const app = await applicationsService.create(
      org.id,
      owner.id,
      { name: `SubRes App ${suffix}` },
      meta,
    );
    applicationId = app.id;
  });

  afterAll(async () => {
    await prisma.application.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.organization.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.$disconnect();
  });

  it("creates a version and marks it latest for its track, un-marking the previous one", async () => {
    const v1 = await versionsService.create(
      applicationId,
      ownerId,
      { androidVersion: "1.0.0", track: "stable" },
      meta,
    );
    expect(v1.isLatest).toBe(true);

    const v2 = await versionsService.create(
      applicationId,
      ownerId,
      { androidVersion: "1.1.0", track: "stable" },
      meta,
    );
    expect(v2.isLatest).toBe(true);

    const refreshedV1 = await versionsService.getOne(applicationId, v1.id);
    expect(refreshedV1.isLatest).toBe(false);
  });

  it("upserts an environment and stores variables/feature flags as JSON", async () => {
    const env = await environmentsService.upsert(
      applicationId,
      ApplicationEnvironmentType.STAGING,
      ownerId,
      {
        baseUrl: "https://staging.example.com",
        variables: { FOO: "bar" },
        featureFlags: { newUi: true },
      },
      meta,
    );

    expect(env.baseUrl).toBe("https://staging.example.com");
    expect(env.variables).toMatchObject({ FOO: "bar" });
    expect(env.featureFlags).toMatchObject({ newUi: true });
  });

  it("creates a secret and never exposes ciphertext material through the service's own return values", async () => {
    const secret = await secretsService.create(
      applicationId,
      ownerId,
      { type: ApplicationSecretType.API_KEY, key: "STRIPE_KEY", value: "sk_live_abcdef123456" },
      meta,
    );

    expect(secret).not.toHaveProperty("encryptedValue");
    expect(secret).not.toHaveProperty("iv");
    expect(secret).not.toHaveProperty("authTag");
    expect(secret.lastFour).toBe("3456");

    const listed = await secretsService.list(applicationId);
    expect(listed.every((s) => !("encryptedValue" in s))).toBe(true);

    const decrypted = await secretsService.decryptForInternalUse(applicationId, secret.id);
    expect(decrypted).toBe("sk_live_abcdef123456");
  });

  it("adds domains and enforces a single primary domain per application", async () => {
    const first = await domainsService.create(
      applicationId,
      ownerId,
      { domain: `first-${suffix}.example.com`, isPrimary: true },
      meta,
    );
    const second = await domainsService.create(
      applicationId,
      ownerId,
      { domain: `second-${suffix}.example.com`, isPrimary: true },
      meta,
    );

    const refreshedFirst = await prisma.applicationDomain.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(refreshedFirst.isPrimary).toBe(false);
    expect(second.isPrimary).toBe(true);
  });

  it("upserts a setting by key", async () => {
    const created = await settingsService.upsert(
      applicationId,
      "maintenanceMode",
      false,
      ownerId,
      meta,
    );
    expect(created.value).toBe(false);

    const updated = await settingsService.upsert(
      applicationId,
      "maintenanceMode",
      true,
      ownerId,
      meta,
    );
    expect(updated.value).toBe(true);
  });
});
