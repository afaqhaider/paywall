export type LicenseType =
  | "INDIVIDUAL"
  | "ORGANIZATION"
  | "SEAT"
  | "DEVICE"
  | "LIFETIME"
  | "TRIAL"
  | "ENTERPRISE"
  | "TEMPORARY"
  | "MANUAL";

export type LicenseStatus = "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";
export type SeatStatus = "AVAILABLE" | "ASSIGNED" | "PENDING" | "INACTIVE";
export type SeatAssignmentStatus = "PENDING" | "ACTIVE" | "REMOVED" | "TRANSFERRED";

export interface License {
  id: string;
  organizationId: string;
  applicationId: string;
  subscriptionId: string | null;
  type: LicenseType;
  status: LicenseStatus;
  seatLimit: number | null;
  deviceLimit: number | null;
  issuedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseAssignment {
  id: string;
  licenseId: string;
  userId: string;
  assignedAt: string;
  unassignedAt: string | null;
}

/** Public shape of a LicenseKey - `keyHash` is never returned by the API. */
export interface LicenseKey {
  id: string;
  licenseId: string;
  displayCode: string;
  activationLimit: number;
  activationCount: number;
  status: LicenseStatus;
  expiresAt: string | null;
  revokedAt: string | null;
  transferredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Only the `generate` response includes the plaintext key - shown exactly once. */
export interface GeneratedLicenseKey extends LicenseKey {
  key: string;
}

export interface Seat {
  id: string;
  licenseId: string;
  status: SeatStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SeatAssignment {
  id: string;
  seatId: string;
  seat?: Seat;
  userId: string;
  status: SeatAssignmentStatus;
  assignedAt: string;
  unassignedAt: string | null;
  createdAt: string;
}

export interface SeatSummary {
  available: number;
  assigned: number;
  pending: number;
  inactive: number;
  total: number;
}

export const LICENSE_TYPES: LicenseType[] = [
  "INDIVIDUAL",
  "ORGANIZATION",
  "SEAT",
  "DEVICE",
  "LIFETIME",
  "TRIAL",
  "ENTERPRISE",
  "TEMPORARY",
  "MANUAL",
];

export const LICENSE_STATUSES: LicenseStatus[] = ["ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"];

/** Badge variant helper - keeps status -> color mapping in one place. */
export function licenseStatusVariant(
  status: LicenseStatus,
): "default" | "success" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "outline";
    case "REVOKED":
    case "EXPIRED":
      return "destructive";
    default:
      return "default";
  }
}
