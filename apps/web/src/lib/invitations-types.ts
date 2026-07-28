import type { ApplicationMember, ApplicationMemberRole } from "./applications-types";

export type DeveloperInvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export interface DeveloperInvitation {
  id: string;
  applicationId: string;
  email: string;
  role: ApplicationMemberRole;
  status: DeveloperInvitationStatus;
  expiresAt: string;
  createdAt: string;
}

export interface DeveloperInvitationCreated extends DeveloperInvitation {
  token: string;
  acceptUrl: string;
}

/**
 * The response of `POST /invitations/:token/accept`. The contract only
 * specifies "the created ApplicationMember", which - unlike the
 * `GET .../members` list shape - is expected to carry `applicationId` too
 * (needed to redirect the accepting user to that application's team page).
 */
export interface AcceptedInvitationMember extends ApplicationMember {
  applicationId: string;
}
