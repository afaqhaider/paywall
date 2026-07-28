export type ApplicationStatus = "ACTIVE" | "ARCHIVED";
export type ApplicationVisibility = "PRIVATE" | "INTERNAL";
export type ApplicationMemberRole =
  "OWNER" | "ADMINISTRATOR" | "MAINTAINER" | "DEVELOPER" | "TESTER" | "SUPPORT" | "VIEWER";
export type ApplicationEnvironmentType = "DEVELOPMENT" | "STAGING" | "PRODUCTION" | "SANDBOX";
export type ApplicationSecretType =
  "API_KEY" | "WEBHOOK_SECRET" | "JWT_SECRET" | "OAUTH_CREDENTIAL" | "PAYMENT_CREDENTIAL" | "OTHER";
export type DomainSslStatus = "PENDING" | "ACTIVE" | "FAILED" | "EXPIRED";
export type DomainVerificationStatus = "PENDING" | "VERIFIED" | "FAILED";

export interface Application {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  displayName: string | null;
  description: string | null;
  category: string | null;
  bundleIdentifier: string | null;
  packageName: string | null;
  webIdentifier: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  primaryColor: string | null;
  status: ApplicationStatus;
  visibility: ApplicationVisibility;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ApplicationListResult {
  items: Application[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApplicationVersion {
  id: string;
  applicationId: string;
  track: string;
  androidVersion: string | null;
  iosVersion: string | null;
  webVersion: string | null;
  buildNumber: string | null;
  minimumSupportedVersion: string | null;
  releaseNotes: string | null;
  releaseDate: string | null;
  isLatest: boolean;
  createdAt: string;
}

export interface ApplicationEnvironment {
  id: string;
  applicationId: string;
  type: ApplicationEnvironmentType;
  baseUrl: string | null;
  apiUrl: string | null;
  variables: Record<string, unknown> | null;
  featureFlags: Record<string, unknown> | null;
}

export interface ApplicationSecretMetadata {
  id: string;
  applicationId: string;
  environmentId: string | null;
  type: ApplicationSecretType;
  key: string;
  lastFour: string | null;
  createdAt: string;
  rotatedAt: string | null;
}

export interface ApplicationDomain {
  id: string;
  applicationId: string;
  domain: string;
  isPrimary: boolean;
  sslStatus: DomainSslStatus;
  verificationStatus: DomainVerificationStatus;
  verifiedAt: string | null;
}

export interface ApplicationSetting {
  id: string;
  applicationId: string;
  key: string;
  value: unknown;
}

export interface ApplicationMember {
  membershipId: string;
  role: ApplicationMemberRole;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
}

export const APPLICATION_MEMBER_ROLES: ApplicationMemberRole[] = [
  "OWNER",
  "ADMINISTRATOR",
  "MAINTAINER",
  "DEVELOPER",
  "TESTER",
  "SUPPORT",
  "VIEWER",
];

export const APPLICATION_SECRET_TYPES: ApplicationSecretType[] = [
  "API_KEY",
  "WEBHOOK_SECRET",
  "JWT_SECRET",
  "OAUTH_CREDENTIAL",
  "PAYMENT_CREDENTIAL",
  "OTHER",
];

export const APPLICATION_ENVIRONMENT_TYPES: ApplicationEnvironmentType[] = [
  "DEVELOPMENT",
  "STAGING",
  "PRODUCTION",
  "SANDBOX",
];
