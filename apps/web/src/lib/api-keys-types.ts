export interface APIClient {
  id: string;
  organizationId: string;
  applicationId: string | null;
  name: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface APIKeyScope {
  id: string;
  apiKeyId: string;
  scope: string;
  createdAt: string;
}

/** Safe shape of an APIKey - `keyHash` is never returned by the API. */
export interface APIKey {
  id: string;
  apiClientId: string;
  name: string;
  keyPrefix: string;
  lastFour: string;
  rateLimitPerMin: number | null;
  expiresAt: string | null;
  revokedAt: string | null;
  rotatedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  scopes: APIKeyScope[];
}

/** Only the `create`/`rotate` responses include the plaintext key - shown exactly once. */
export interface GeneratedAPIKey extends APIKey {
  plainText: string;
}
