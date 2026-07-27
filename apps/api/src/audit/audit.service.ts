import { Injectable } from "@nestjs/common";
import type { AuditAction, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface RecordAuditEventInput {
  action: AuditAction;
  userId?: string;
  organizationId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEventInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: input.action,
        userId: input.userId,
        organizationId: input.organizationId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async listForOrganization(organizationId: string, take = 50) {
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
