import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export const SDK_PLATFORMS = ["web", "flutter", "android", "ios", "node"] as const;
export type SdkPlatform = (typeof SDK_PLATFORMS)[number];

export type SdkLanguage = "typescript" | "dart" | "kotlin" | "swift" | "javascript";

export interface SdkConfig {
  platform: SdkPlatform;
  language: SdkLanguage;
  snippet: string;
  instructions: string;
}

/**
 * Pure documentation/scaffolding generator - no persisted SDK config, just a
 * short, realistic initialization sample per platform built from the
 * application's identifiers and the target environment's API URL.
 */
@Injectable()
export class SdkConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    applicationId: string,
    platform: string,
    environmentId: string,
  ): Promise<SdkConfig> {
    if (!SDK_PLATFORMS.includes(platform as SdkPlatform)) {
      throw new BadRequestException(
        `Unknown platform "${platform}" - expected one of ${SDK_PLATFORMS.join(", ")}`,
      );
    }

    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, webIdentifier: true, bundleIdentifier: true, packageName: true },
    });
    if (!application) {
      throw new NotFoundException("Application not found");
    }

    const environment = await this.prisma.applicationEnvironment.findUnique({
      where: { id: environmentId },
    });
    if (!environment || environment.applicationId !== applicationId) {
      throw new NotFoundException("Environment not found for this application");
    }

    const baseUrl = environment.apiUrl ?? environment.baseUrl ?? "https://api.example.com";
    const typedPlatform = platform as SdkPlatform;

    return this.buildConfig(typedPlatform, {
      applicationId,
      baseUrl,
      webIdentifier: application.webIdentifier,
      bundleIdentifier: application.bundleIdentifier,
      packageName: application.packageName,
    });
  }

  private buildConfig(
    platform: SdkPlatform,
    ctx: {
      applicationId: string;
      baseUrl: string;
      webIdentifier: string | null;
      bundleIdentifier: string | null;
      packageName: string | null;
    },
  ): SdkConfig {
    switch (platform) {
      case "web":
        return {
          platform,
          language: "typescript",
          snippet: [
            `import { SSZClient } from "@ssz/sdk-web";`,
            ``,
            `const client = new SSZClient({`,
            `  apiKey: process.env.SSZ_API_KEY,`,
            `  baseUrl: "${ctx.baseUrl}",`,
            `  applicationId: "${ctx.applicationId}",`,
            `});`,
          ].join("\n"),
          instructions:
            "Install with `npm install @ssz/sdk-web`, then initialize the client once at app " +
            "startup using the snippet above. Never ship a secret API key to the browser - use " +
            "a publishable/client-scoped key.",
        };
      case "node":
        return {
          platform,
          language: "javascript",
          snippet: [
            `const { SSZClient } = require("@ssz/sdk-node");`,
            ``,
            `const client = new SSZClient({`,
            `  apiKey: process.env.SSZ_API_KEY,`,
            `  baseUrl: "${ctx.baseUrl}",`,
            `  applicationId: "${ctx.applicationId}",`,
            `});`,
          ].join("\n"),
          instructions:
            "Install with `npm install @ssz/sdk-node`, then initialize the client once per " +
            "process. Keep the API key in an environment variable, never commit it.",
        };
      case "flutter":
        return {
          platform,
          language: "dart",
          snippet: [
            `import 'package:ssz_sdk_flutter/ssz_sdk_flutter.dart';`,
            ``,
            `final client = SSZClient(`,
            `  apiKey: const String.fromEnvironment('SSZ_API_KEY'),`,
            `  baseUrl: '${ctx.baseUrl}',`,
            `  applicationId: '${ctx.applicationId}',`,
            `);`,
          ].join("\n"),
          instructions:
            "Add `ssz_sdk_flutter` to pubspec.yaml, then construct the client once (e.g. in a " +
            "top-level provider) and pass `--dart-define=SSZ_API_KEY=...` at build time.",
        };
      case "android":
        return {
          platform,
          language: "kotlin",
          snippet: [
            `import com.sszentronics.sdk.SSZClient`,
            ``,
            `val client = SSZClient.Builder()`,
            `    .apiKey(BuildConfig.SSZ_API_KEY)`,
            `    .baseUrl("${ctx.baseUrl}")`,
            `    .applicationId("${ctx.applicationId}")`,
            `    .packageName("${ctx.packageName ?? "com.example.app"}")`,
            `    .build()`,
          ].join("\n"),
          instructions:
            "Add the SDK to your app-level `build.gradle`, then build a singleton `SSZClient` in " +
            "your `Application` class. Store `SSZ_API_KEY` in `local.properties`, never in source.",
        };
      case "ios":
        return {
          platform,
          language: "swift",
          snippet: [
            `import SSZSDK`,
            ``,
            `let client = SSZClient(`,
            `    apiKey: ProcessInfo.processInfo.environment["SSZ_API_KEY"] ?? "",`,
            `    baseUrl: "${ctx.baseUrl}",`,
            `    applicationId: "${ctx.applicationId}",`,
            `    bundleIdentifier: "${ctx.bundleIdentifier ?? "com.example.app"}"`,
            `)`,
          ].join("\n"),
          instructions:
            "Add SSZSDK via Swift Package Manager, then construct the client once in your " +
            "`AppDelegate`/`App` initializer. Inject `SSZ_API_KEY` via an Xcode configuration, " +
            "not source control.",
        };
    }
  }
}
