import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { RuntimeAuthorizationService } from "../entitlements/runtime-authorization.service";
import { ApiClientsService } from "./api-clients.service";
import { ApiKeysService } from "./api-keys.service";

describe("ApiKeysService (integration)", () => {
  const prisma = new PrismaService();
  const auditService = new AuditService(prisma);
  const organizationsService = new OrganizationsService(prisma, auditService);
  const apiClientsService = new ApiClientsService(prisma);
  const apiKeysService = new ApiKeysService(prisma, auditService);
  const runtimeAuth = new RuntimeAuthorizationService(prisma);

  const suffix = randomUUID();
  const meta = { ipAddress: "127.0.0.1", userAgent: "vitest" };
  let ownerId: string;
  let organizationId: string;
  let apiClientId: string;

  beforeAll(async () => {
    await prisma.$connect();

    const owner = await prisma.user.create({
      data: { email: `apikey-owner-${suffix}@apikeytest.local`, passwordHash: "not-a-real-hash" },
    });
    ownerId = owner.id;

    const org = await organizationsService.create(owner.id, { name: `API Org ${suffix}` }, meta);
    organizationId = org.id;

    const client = await apiClientsService.create(organizationId, ownerId, {
      name: `API Client ${suffix}`,
    });
    apiClientId = client.id;
  });

  afterAll(async () => {
    await prisma.aPIClient.deleteMany({ where: { id: apiClientId } });
    await prisma.organization.deleteMany({ where: { slug: { contains: suffix } } });
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.$disconnect();
  });

  it("returns the plaintext key exactly once and never persists or re-exposes it", async () => {
    const created = await apiKeysService.create(
      apiClientId,
      { name: "Primary key" },
      ownerId,
      meta,
    );

    expect(created.plainText).toMatch(/^sszk_live_/);
    expect(created).not.toHaveProperty("keyHash");

    // The plaintext must not be recoverable from the DB row under any column.
    const row = await prisma.aPIKey.findUniqueOrThrow({ where: { id: created.id } });
    const rowValues = Object.values(row).map((v) => String(v));
    expect(rowValues.some((v) => v.includes(created.plainText))).toBe(false);
    expect(row.keyHash).not.toBe(created.plainText);

    // list() must never surface keyHash either.
    const listed = await apiKeysService.list(apiClientId);
    expect(listed.every((k) => !("keyHash" in k))).toBe(true);

    // But the plaintext key still validates correctly through the runtime path
    // (RuntimeAuthorizationService hashes-and-compares, it never reads plaintext back).
    const validated = await runtimeAuth.validateApiKey(created.plainText);
    expect(validated.valid).toBe(true);
    if (validated.valid) {
      expect(validated.apiKeyId).toBe(created.id);
    }

    // A tampered/guessed key must not validate.
    const invalid = await runtimeAuth.validateApiKey(`${created.plainText}x`);
    expect(invalid.valid).toBe(false);
  });

  it("revoking a key immediately invalidates it against RuntimeAuthorizationService", async () => {
    const created = await apiKeysService.create(apiClientId, { name: "Revoke me" }, ownerId, meta);

    const revoked = await apiKeysService.revoke(apiClientId, created.id, ownerId, meta);
    expect(revoked.revokedAt).not.toBeNull();

    const validated = await runtimeAuth.validateApiKey(created.plainText);
    expect(validated.valid).toBe(false);
  });
});
