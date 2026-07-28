import { Injectable } from "@nestjs/common";
import { NotificationDeliveryStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  withTimeout,
  type HealthCheckResult,
  type HealthProvider,
} from "../health-provider.interface";

const FAILED_DEGRADED_THRESHOLD = 20;

@Injectable()
export class NotificationHealthProvider implements HealthProvider {
  readonly name = "notification";

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResult> {
    return withTimeout(this.name, async () => {
      const [pending, failed] = await Promise.all([
        this.prisma.notificationDelivery.count({
          where: {
            status: {
              in: [NotificationDeliveryStatus.PENDING, NotificationDeliveryStatus.RETRYING],
            },
          },
        }),
        this.prisma.notificationDelivery.count({
          where: { status: NotificationDeliveryStatus.FAILED },
        }),
      ]);

      const details = { pending, failed };
      if (failed > FAILED_DEGRADED_THRESHOLD) {
        return {
          name: this.name,
          status: "DEGRADED",
          message: "High number of failed notification deliveries",
          checkedAt: new Date().toISOString(),
          details,
        };
      }

      return { name: this.name, status: "HEALTHY", checkedAt: new Date().toISOString(), details };
    });
  }
}
