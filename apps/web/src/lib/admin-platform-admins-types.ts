export interface PlatformAdmin {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  grantedAt: string;
  grantedById?: string | null;
}
