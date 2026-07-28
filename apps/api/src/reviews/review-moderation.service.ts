import { Injectable, NotFoundException } from "@nestjs/common";
import { ReviewReportStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RequestMeta } from "../common/utils/request-meta.util";

@Injectable()
export class ReviewModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listReports(status?: ReviewReportStatus) {
    return this.prisma.reviewReport.findMany({
      where: status ? { status } : undefined,
      include: { review: { include: { listing: { include: { application: true } } } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async resolve(reportId: string, status: ReviewReportStatus, userId: string, meta: RequestMeta) {
    const report = await this.prisma.reviewReport.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException("Review report not found");
    }

    const updated = await this.prisma.reviewReport.update({
      where: { id: reportId },
      data: { status, resolvedAt: new Date() },
    });

    await this.auditService.record({
      action: "REVIEW_REPORT_RESOLVED",
      userId,
      metadata: { reportId, status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
