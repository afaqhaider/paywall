export interface ImpersonationTokenResponse {
  impersonationToken: string;
  expiresAt: string;
}

export interface ImpersonationRedeemResponse {
  accessToken: string;
  accessTokenExpiresInMs: number;
  [key: string]: unknown;
}

export interface LoginLinkResponse {
  url: string;
  expiresAt: string;
}

export interface ImpersonationHistoryItem {
  id: string;
  targetUserId: string;
  targetEmail?: string | null;
  adminUserId: string;
  adminEmail?: string | null;
  targetRole?: string | null;
  reason: string | null;
  createdAt: string;
  redeemedAt: string | null;
}
