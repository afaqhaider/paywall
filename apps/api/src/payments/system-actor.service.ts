import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const SYSTEM_USER_EMAIL = "system+payment-webhooks@internal.paywall.local";

/**
 * Webhook-driven subscription transitions still go through
 * `SubscriptionsService`'s normal lifecycle methods (never a raw DB write),
 * and those methods record `createdById` on the `SubscriptionEvent` they
 * write. There's no human actor for a provider-initiated event, so this
 * lazily creates (once) a disabled, unusable "system" User row and reuses
 * its id - the event history then honestly shows these transitions were
 * system-triggered rather than attributing them to whichever admin
 * happened to be logged in.
 */
@Injectable()
export class SystemActorService {
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
        displayName: "System (Payment Webhooks)",
        isActive: false,
      },
    });
    this.cachedUserId = created.id;
    return created.id;
  }
}
