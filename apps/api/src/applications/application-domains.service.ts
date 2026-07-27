import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import { DomainVerificationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateApplicationDomainDto } from "./dto/create-application-domain.dto";
import type { UpdateApplicationDomainDto } from "./dto/update-application-domain.dto";

@Injectable()
export class ApplicationDomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    applicationId: string,
    userId: string,
    dto: CreateApplicationDomainDto,
    meta: RequestMeta,
  ) {
    const verificationToken = randomBytes(16).toString("hex");

    const domain = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.applicationDomain.updateMany({
          where: { applicationId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.applicationDomain.create({
        data: {
          applicationId,
          domain: dto.domain,
          isPrimary: dto.isPrimary ?? false,
          verificationToken,
        },
      });
    });

    await this.auditService.record({
      action: "APPLICATION_DOMAIN_ADDED",
      userId,
      applicationId,
      metadata: { domainId: domain.id, domain: domain.domain },
      ...meta,
    });

    return domain;
  }

  async list(applicationId: string) {
    return this.prisma.applicationDomain.findMany({
      where: { applicationId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
  }

  async update(
    applicationId: string,
    domainId: string,
    userId: string,
    dto: UpdateApplicationDomainDto,
    meta: RequestMeta,
  ) {
    await this.getOneOrThrow(applicationId, domainId);

    const domain = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.applicationDomain.updateMany({
          where: { applicationId, isPrimary: true, NOT: { id: domainId } },
          data: { isPrimary: false },
        });
      }

      return tx.applicationDomain.update({
        where: { id: domainId },
        data: { isPrimary: dto.isPrimary },
      });
    });

    await this.auditService.record({
      action: "APPLICATION_DOMAIN_UPDATED",
      userId,
      applicationId,
      metadata: { domainId },
      ...meta,
    });

    return domain;
  }

  async remove(applicationId: string, domainId: string, userId: string, meta: RequestMeta) {
    const existing = await this.getOneOrThrow(applicationId, domainId);
    await this.prisma.applicationDomain.delete({ where: { id: domainId } });

    await this.auditService.record({
      action: "APPLICATION_DOMAIN_REMOVED",
      userId,
      applicationId,
      metadata: { domainId, domain: existing.domain },
      ...meta,
    });
  }

  /**
   * Stubbed verification: a real deployment would check a DNS TXT record
   * (or well-known file) for `verificationToken` and query a certificate
   * provider for SSL status. This marks VERIFIED immediately - flagged as
   * a Phase 4 follow-up, not a shipped verification guarantee.
   */
  async verify(applicationId: string, domainId: string, userId: string, meta: RequestMeta) {
    const existing = await this.getOneOrThrow(applicationId, domainId);

    const domain = await this.prisma.applicationDomain.update({
      where: { id: domainId },
      data: { verificationStatus: DomainVerificationStatus.VERIFIED, verifiedAt: new Date() },
    });

    await this.auditService.record({
      action: "APPLICATION_DOMAIN_VERIFIED",
      userId,
      applicationId,
      metadata: { domainId, domain: existing.domain },
      ...meta,
    });

    return domain;
  }

  private async getOneOrThrow(applicationId: string, domainId: string) {
    const domain = await this.prisma.applicationDomain.findUnique({ where: { id: domainId } });
    if (!domain || domain.applicationId !== applicationId) {
      throw new NotFoundException("Domain not found");
    }
    return domain;
  }
}
