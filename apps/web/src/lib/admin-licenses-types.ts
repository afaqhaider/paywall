import type { License, LicenseType } from "./licenses-types";
import type { GeneratedLicenseKey } from "./licenses-types";

export interface AdminLicenseListItem extends License {
  organizationName?: string;
}

export interface AdminGenerateLicenseRequest {
  organizationId: string;
  applicationId: string;
  subscriptionId?: string;
  type: LicenseType;
  seatLimit?: number;
  deviceLimit?: number;
  expiresAt?: string;
}

export type { GeneratedLicenseKey };
