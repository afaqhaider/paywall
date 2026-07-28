/** Every fraud/abuse signal type shares a loose shape - fields beyond the
 * common ones vary per signal and are rendered generically. */
export interface AdminFraudSignal {
  id: string;
  organizationId?: string | null;
  userId?: string | null;
  applicationId?: string | null;
  reason?: string | null;
  severity?: string | null;
  createdAt: string;
  [key: string]: unknown;
}

export const FRAUD_SIGNAL_TYPES = [
  "failed-payments",
  "suspicious-logins",
  "device-abuse",
  "api-abuse",
  "webhook-abuse",
  "excessive-trials",
  "chargebacks",
] as const;

export type FraudSignalType = (typeof FRAUD_SIGNAL_TYPES)[number];

export function fraudSignalLabel(type: FraudSignalType): string {
  switch (type) {
    case "failed-payments":
      return "Failed Payments";
    case "suspicious-logins":
      return "Suspicious Logins";
    case "device-abuse":
      return "Device Abuse";
    case "api-abuse":
      return "API Abuse";
    case "webhook-abuse":
      return "Webhook Abuse";
    case "excessive-trials":
      return "Excessive Trials";
    case "chargebacks":
      return "Chargebacks";
    default:
      return type;
  }
}
