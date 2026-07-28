import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateAllowedOriginDto } from "./dto/create-allowed-origin.dto";

/** Must parse as an absolute URL with a scheme and host and nothing else (no path/query/hash). */
function assertValidOrigin(origin: string): void {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new BadRequestException("origin must be a valid URL, e.g. https://app.example.com");
  }

  if (!parsed.host) {
    throw new BadRequestException("origin must include a host");
  }
}

@Injectable()
export class AllowedOriginsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(applicationId: string) {
    return this.prisma.allowedOrigin.findMany({
      where: { applicationId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(
    applicationId: string,
    dto: CreateAllowedOriginDto,
    userId: string,
    meta: RequestMeta,
  ) {
    assertValidOrigin(dto.origin);

    if (dto.environmentId) {
      const environment = await this.prisma.applicationEnvironment.findUnique({
        where: { id: dto.environmentId },
      });
      if (!environment || environment.applicationId !== applicationId) {
        throw new NotFoundException("Environment not found");
      }
    }

    const allowedOrigin = await this.prisma.allowedOrigin.create({
      data: {
        applicationId,
        environmentId: dto.environmentId,
        origin: dto.origin,
      },
    });

    await this.auditService.record({
      action: "ALLOWED_ORIGIN_ADDED",
      userId,
      applicationId,
      metadata: { allowedOriginId: allowedOrigin.id, origin: allowedOrigin.origin },
      ...meta,
    });

    return allowedOrigin;
  }

  async remove(applicationId: string, originId: string, userId: string, meta: RequestMeta) {
    const existing = await this.prisma.allowedOrigin.findUnique({ where: { id: originId } });
    if (!existing || existing.applicationId !== applicationId) {
      throw new NotFoundException("Allowed origin not found");
    }

    await this.prisma.allowedOrigin.delete({ where: { id: originId } });

    await this.auditService.record({
      action: "ALLOWED_ORIGIN_REMOVED",
      userId,
      applicationId,
      metadata: { allowedOriginId: originId, origin: existing.origin },
      ...meta,
    });
  }
}
