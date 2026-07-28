import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LicenseStatus, type License } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LicensesService } from "../licenses/licenses.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateAdminLicenseDto } from "./dto/create-admin-license.dto";
import type { TransferAdminLicenseDto } from "./dto/transfer-admin-license.dto";

/**
 * Thin platform-admin wrappers around `LicensesService`, plus admin-only
 * status transitions (deactivate/reactivate) that don't exist anywhere else
 * - `LicensesService.update()` deliberately excludes `status` (see its own
 * doc comment: "status is only ever changed through the dedicated `revoke`
 * action") and `revoke()` only ever moves a license to REVOKED, so there is
 * no existing capability to suspend a license and bring it back. Those two
 * transitions are implemented here as direct, documented raw
 * `prisma.license.update()` calls rather than new methods on
 * `LicensesService`, the same "deliberate raw admin override, not a
 * lifecycle transition" rationale used for admin-subscriptions'
 * `adjustRenewalDate`. One shared `LICENSE_ADMIN_ACTION` audit action
 * covers every mutation here, differentiated by `metadata.action`.
 */
@Injectable()
export class AdminLicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly licensesService: LicensesService,
  ) {}

  async create(adminUserId: string, dto: CreateAdminLicenseDto, meta: RequestMeta) {
    const license = await this.licensesService.create(dto.organizationId, adminUserId, dto, meta);
    await this.recordAdminAction(adminUserId, license, meta, { action: "generate" });
    return license;
  }

  async transfer(
    licenseId: string,
    adminUserId: string,
    dto: TransferAdminLicenseDto,
    meta: RequestMeta,
  ) {
    const existing = await this.getOwned(licenseId);
    const assignment = await this.licensesService.transfer(
      licenseId,
      existing.organizationId,
      adminUserId,
      dto,
      meta,
    );
    await this.recordAdminAction(adminUserId, existing, meta, {
      action: "transfer",
      toUserId: dto.toUserId,
    });
    return assignment;
  }

  async deactivate(licenseId: string, adminUserId: string, meta: RequestMeta): Promise<License> {
    const existing = await this.getOwned(licenseId);
    if (existing.status !== LicenseStatus.ACTIVE) {
      throw new BadRequestException("Only an ACTIVE license can be deactivated");
    }

    const license = await this.prisma.license.update({
      where: { id: licenseId },
      data: { status: LicenseStatus.SUSPENDED },
    });

    await this.recordAdminAction(adminUserId, license, meta, { action: "deactivate" });
    return license;
  }

  async reactivate(licenseId: string, adminUserId: string, meta: RequestMeta): Promise<License> {
    const existing = await this.getOwned(licenseId);
    if (existing.status !== LicenseStatus.SUSPENDED) {
      throw new BadRequestException("Only a SUSPENDED license can be reactivated");
    }

    const license = await this.prisma.license.update({
      where: { id: licenseId },
      data: { status: LicenseStatus.ACTIVE },
    });

    await this.recordAdminAction(adminUserId, license, meta, { action: "reactivate" });
    return license;
  }

  async revoke(licenseId: string, adminUserId: string, meta: RequestMeta): Promise<License> {
    const existing = await this.getOwned(licenseId);
    const license = await this.licensesService.revoke(
      licenseId,
      existing.organizationId,
      adminUserId,
      meta,
    );
    await this.recordAdminAction(adminUserId, license, meta, { action: "revoke" });
    return license;
  }

  private async getOwned(licenseId: string): Promise<License> {
    const license = await this.prisma.license.findUnique({ where: { id: licenseId } });
    if (!license) {
      throw new NotFoundException("License not found");
    }
    return license;
  }

  private async recordAdminAction(
    adminUserId: string,
    license: License,
    meta: RequestMeta,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({
      action: "LICENSE_ADMIN_ACTION",
      userId: adminUserId,
      organizationId: license.organizationId,
      applicationId: license.applicationId,
      metadata: { licenseId: license.id, ...metadata },
      ...meta,
    });
  }
}
