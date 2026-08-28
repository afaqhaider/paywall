import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const SYSTEM_USER_EMAIL = "system+api-key-runtime@internal.paywall.local";

/**
 * Same lazily-created-disabled-User pattern as
 * `apps/api/src/payments/system-actor.service.ts`, but for audit events
 * triggered by an external API-key caller (e.g. an SDK-driven device
 * registration) rather than a payment webhook - kept as a separate row so
 * audit history distinguishes the two kinds of system-triggered writes
 * instead of misattributing one to the other.
 */
@Injectable()
export class ApiKeySystemActorService {
  private cachedUserId: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getSystemUserId(): Promise<string> {
    if (this.cachedUserId) {
      return this.cachedUserId;
    }

    const existing = await this.prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
    if (existing) {
      this.cachedUserId = existing.id;
      return existing.id;
    }

    const created = await this.prisma.user.create({
      data: {
        email: SYSTEM_USER_EMAIL,
        passwordHash: "!disabled!",
        emailVerified: true,
        displayName: "System (API Key Runtime)",
        isActive: false,
      },
    });
    this.cachedUserId = created.id;
    return created.id;
  }
}
