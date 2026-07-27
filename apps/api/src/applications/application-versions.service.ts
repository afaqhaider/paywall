import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";
import type { CreateApplicationVersionDto } from "./dto/create-application-version.dto";
import type { UpdateApplicationVersionDto } from "./dto/update-application-version.dto";

@Injectable()
export class ApplicationVersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    applicationId: string,
    userId: string,
    dto: CreateApplicationVersionDto,
    meta: RequestMeta,
  ) {
    const track = dto.track ?? "stable";
    const markLatest = dto.isLatest ?? true;

    const version = await this.prisma.$transaction(async (tx) => {
      if (markLatest) {
        await tx.applicationVersion.updateMany({
          where: { applicationId, track, isLatest: true },
          data: { isLatest: false },
        });
      }

      return tx.applicationVersion.create({
        data: {
          applicationId,
          track,
          androidVersion: dto.androidVersion,
          iosVersion: dto.iosVersion,
          webVersion: dto.webVersion,
          buildNumber: dto.buildNumber,
          minimumSupportedVersion: dto.minimumSupportedVersion,
          releaseNotes: dto.releaseNotes,
          releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : undefined,
          isLatest: markLatest,
          createdById: userId,
        },
      });
    });

    await this.auditService.record({
      action: "APPLICATION_VERSION_CREATED",
      userId,
      applicationId,
      metadata: { track, versionId: version.id },
      ...meta,
    });

    return version;
  }

  async list(applicationId: string, track?: string) {
    return this.prisma.applicationVersion.findMany({
      where: { applicationId, ...(track ? { track } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  async getOne(applicationId: string, versionId: string) {
    const version = await this.prisma.applicationVersion.findUnique({ where: { id: versionId } });

    if (!version || version.applicationId !== applicationId) {
      throw new NotFoundException("Version not found");
    }

    return version;
  }

  async update(
    applicationId: string,
    versionId: string,
    userId: string,
    dto: UpdateApplicationVersionDto,
    meta: RequestMeta,
  ) {
    const existing = await this.getOne(applicationId, versionId);
    const track = dto.track ?? existing.track;

    const version = await this.prisma.$transaction(async (tx) => {
      if (dto.isLatest) {
        await tx.applicationVersion.updateMany({
          where: { applicationId, track, isLatest: true, NOT: { id: versionId } },
          data: { isLatest: false },
        });
      }

      return tx.applicationVersion.update({
        where: { id: versionId },
        data: {
          track: dto.track,
          androidVersion: dto.androidVersion,
          iosVersion: dto.iosVersion,
          webVersion: dto.webVersion,
          buildNumber: dto.buildNumber,
          minimumSupportedVersion: dto.minimumSupportedVersion,
          releaseNotes: dto.releaseNotes,
          releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : undefined,
          isLatest: dto.isLatest,
        },
      });
    });

    await this.auditService.record({
      action: "APPLICATION_VERSION_UPDATED",
      userId,
      applicationId,
      metadata: { versionId },
      ...meta,
    });

    return version;
  }

  async remove(applicationId: string, versionId: string, userId: string, meta: RequestMeta) {
    await this.getOne(applicationId, versionId);
    await this.prisma.applicationVersion.delete({ where: { id: versionId } });

    await this.auditService.record({
      action: "APPLICATION_VERSION_DELETED",
      userId,
      applicationId,
      metadata: { versionId },
      ...meta,
    });
  }
}
