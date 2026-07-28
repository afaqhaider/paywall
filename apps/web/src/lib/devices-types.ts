export type DevicePlatform = "IOS" | "ANDROID" | "WEB" | "DESKTOP" | "OTHER";
export type DeviceStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export interface DeviceRegistration {
  id: string;
  applicationId: string;
  organizationId: string | null;
  userId: string | null;
  licenseId: string | null;
  deviceId: string;
  platform: DevicePlatform;
  status: DeviceStatus;
  appVersion: string | null;
  osVersion: string | null;
  pushToken: string | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export const DEVICE_PLATFORMS: DevicePlatform[] = ["IOS", "ANDROID", "WEB", "DESKTOP", "OTHER"];
