export interface OAuthCredentialMetadata {
  id: string;
  clientId: string;
  lastFour: string;
  rotatedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface OAuthCredentialCreated {
  id: string;
  clientId: string;
  lastFour: string;
  plainText: string;
  createdAt: string;
}

export interface OAuthRedirectUri {
  id: string;
  uri: string;
}

export interface OAuthCallbackUrl {
  id: string;
  url: string;
}

export interface OAuthApplication {
  id: string;
  applicationId: string;
  name: string;
  createdAt: string;
  credentials: OAuthCredentialMetadata[];
  redirectUris: OAuthRedirectUri[];
  callbackUrls: OAuthCallbackUrl[];
}

export interface OAuthApplicationCreated {
  id: string;
  applicationId: string;
  name: string;
  createdAt: string;
  credentials: OAuthCredentialCreated[];
}
