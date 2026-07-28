import { Injectable } from "@nestjs/common";
import { WebhookDeliveryStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  withTimeout,
  type HealthCheckResult,
  type HealthProvider,
} from "../health-provider.interface";

const EXHAUSTED_DEGRADED_THRESHOLD = 20;

@Injectable()
export class WebhookHealthProvider implements HealthProvider {
  readonly name = "webhook";

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    return withTimeout(this.name, async () => {
      const [pending, exhausted] = await Promise.all([
        this.prisma.webhookDelivery.count({
          where: {
            status: { in: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.RETRYING] },
          },
        }),
        this.prisma.webhookDelivery.count({ where: { status: WebhookDeliveryStatus.EXHAUSTED } }),
      ]);

      const details = { pending, exhausted };
      if (exhausted > EXHAUSTED_DEGRADED_THRESHOLD) {
        return {
          name: this.name,
          status: "DEGRADED",
          message: "High number of exhausted webhook deliveries",
          checkedAt: new Date().toISOString(),
          details,
        };
      }

      return { name: this.name, status: "HEALTHY", checkedAt: new Date().toISOString(), details };
    });
  }
}
