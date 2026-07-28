export type SdkPlatform = "web" | "flutter" | "android" | "ios" | "node";

export type SdkLanguage = "typescript" | "dart" | "kotlin" | "swift" | "javascript";

export interface SdkConfig {
  platform: SdkPlatform;
  language: SdkLanguage;
  snippet: string;
  instructions: string;
}

export const SDK_PLATFORMS: SdkPlatform[] = ["web", "flutter", "android", "ios", "node"];

export const SDK_PLATFORM_LABELS: Record<SdkPlatform, string> = {
  web: "Web",
  flutter: "Flutter",
  android: "Android",
  ios: "iOS",
  node: "Node.js",
};
