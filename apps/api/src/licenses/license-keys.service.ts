import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { LicenseStatus, type LicenseKey } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { generateLicenseKey } from "../common/utils/license-key.util";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { GenerateLicenseKeyDto } from "./dto/generate-license-key.dto";
import type { TransferLicenseKeyDto } from "./dto/transfer-license-key.dto";

type LicenseKeyWithLicense = LicenseKey & { license: { organizationId: string } };

/** Public shape of a LicenseKey - `keyHash` is never returned by any endpoint. */
function toPublicKey(key: LicenseKey) {
  const { keyHash: _keyHash, ...rest } = key;
  return rest;
}

@Injectable()
export class LicenseKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generate(
    licenseId: string,
    organizationId: string,
    userId: string,
    dto: GenerateLicenseKeyDto,
    meta: RequestMeta,
  ) {
    const license = await this.prisma.license.findUnique({ where: { id: licenseId } });
    if (!license || license.organizationId !== organizationId) {
      throw new NotFoundException("License not found");
    }
    if (license.status !== LicenseStatus.ACTIVE) {
      throw new BadRequestException("Cannot generate a key for a license that is not active");
    }

    const generated = generateLicenseKey();

    const licenseKey = await this.prisma.licenseKey.create({
      data: {
        licenseId,
        keyHash: generated.keyHash,
        displayCode: generated.displayCode,
        activationLimit: dto.activationLimit ?? 1,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.auditService.record({
      action: "LICENSE_KEY_GENERATED",
      userId,
      organizationId,
      applicationId: license.applicationId,
      metadata: { licenseId, licenseKeyId: licenseKey.id },
      ...meta,
    });

    // The plaintext key is returned exactly once, here, and never persisted
    // or returned by any other endpoint (list/get always use toPublicKey).
    return { ...toPublicKey(licenseKey), key: generated.plainText };
  }

  async list(licenseId: string, organizationId: string) {
    const license = await this.prisma.license.findUnique({ where: { id: licenseId } });
    if (!license || license.organizationId !== organizationId) {
      throw new NotFoundException("License not found");
    }

    const keys = await this.prisma.licenseKey.findMany({
      where: { licenseId },
      orderBy: { createdAt: "desc" },
    });
    return keys.map(toPublicKey);
  }

  /**
   * Activates a license key: validates it (not revoked, not expired, under
   * its activation limit) then increments `activationCount`. The increment
   * uses a compare-and-swap (`updateMany` conditioned on the previously-read
   * `activationCount`) rather than a plain read-then-write, so two
   * concurrent activation requests against the last remaining activation
   * slot can't both succeed - the loser's `updateMany` affects zero rows,
   * causing a retry that re-checks the limit against fresh data. This is
   * the same pattern used for seat assignment below (see seats.service.ts).
   */
  async activate(licenseKeyId: string, organizationId: string, userId: string, meta: RequestMeta) {
    const MAX_ATTEMPTS = 5;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const key = await this.getOwnedKey(licenseKeyId, organizationId);

      if (key.status === LicenseStatus.REVOKED) {
        throw new BadRequestException("License key has been revoked");
      }
      if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException("License key has expired");
      }
      if (key.activationCount >= key.activationLimit) {
        throw new ConflictException("License key activation limit has been reached");
      }

      const result = await this.prisma.licenseKey.updateMany({
        where: { id: licenseKeyId, activationCount: key.activationCount },
        data: { activationCount: { increment: 1 } },
      });

      if (result.count === 1) {
        await this.auditService.record({
          action: "LICENSE_KEY_ACTIVATED",
          userId,
          organizationId,
          metadata: { licenseId: key.licenseId, licenseKeyId },
          ...meta,
        });

        const updated = await this.prisma.licenseKey.findUniqueOrThrow({
          where: { id: licenseKeyId },
        });
        return toPublicKey(updated);
      }
      // Lost the race to another concurrent activation - retry with fresh data.
    }

    throw new ConflictException("Could not activate license key, please retry");
  }

  async revoke(licenseKeyId: string, organizationId: string, userId: string, meta: RequestMeta) {
    const key = await this.getOwnedKey(licenseKeyId, organizationId);

    if (key.status === LicenseStatus.REVOKED) {
      throw new BadRequestException("License key is already revoked");
    }

    const revoked = await this.prisma.licenseKey.update({
      where: { id: licenseKeyId },
      data: { status: LicenseStatus.REVOKED, revokedAt: new Date() },
    });

    await this.auditService.record({
      action: "LICENSE_KEY_REVOKED",
      userId,
      organizationId,
      metadata: { licenseId: key.licenseId, licenseKeyId },
      ...meta,
    });

    return toPublicKey(revoked);
  }

  /**
   * Design decision (schema is ambiguous here): `LicenseKey.transferredAt`
   * exists with no accompanying "transfer history" table, and `licenseId`
   * is a plain mutable FK rather than an immutable identifier. We interpret
   * "transfer" as *moving the key to a different License row* (e.g. a
   * renewal creates a new License and the customer's existing activated key
   * should carry over to it) - not merely stamping a timestamp on the
   * license the key already belongs to, which would be a no-op with no
   * observable effect. `keyHash`/`displayCode`/`activationCount` are left
   * untouched so the physical key the customer holds keeps working exactly
   * as before; only its owning License changes. The target license must
   * belong to the same organization as the source (this method is only
   * reachable through an org-scoped route, so that's also what keeps a key
   * from being transferred across tenants).
   */
  async transfer(
    licenseKeyId: string,
    organizationId: string,
    dto: TransferLicenseKeyDto,
    userId: string,
    meta: RequestMeta,
  ) {
    const key = await this.getOwnedKey(licenseKeyId, organizationId);

    if (dto.targetLicenseId === key.licenseId) {
      throw new BadRequestException("License key already belongs to this license");
    }

    const targetLicense = await this.prisma.license.findUnique({
      where: { id: dto.targetLicenseId },
    });
    if (!targetLicense || targetLicense.organizationId !== organizationId) {
      throw new NotFoundException("Target license not found in this organization");
    }

    const transferred = await this.prisma.licenseKey.update({
      where: { id: licenseKeyId },
      data: { licenseId: dto.targetLicenseId, transferredAt: new Date() },
    });

    await this.auditService.record({
      action: "LICENSE_KEY_TRANSFERRED",
      userId,
      organizationId,
      metadata: {
        licenseKeyId,
        fromLicenseId: key.licenseId,
        toLicenseId: dto.targetLicenseId,
      },
      ...meta,
    });

    return toPublicKey(transferred);
  }

  private async getOwnedKey(
    licenseKeyId: string,
    organizationId: string,
  ): Promise<LicenseKeyWithLicense> {
    const key = await this.prisma.licenseKey.findUnique({
      where: { id: licenseKeyId },
      include: { license: { select: { organizationId: true } } },
    });
    if (!key || key.license.organizationId !== organizationId) {
      throw new NotFoundException("License key not found");
    }
    return key;
  }
}
