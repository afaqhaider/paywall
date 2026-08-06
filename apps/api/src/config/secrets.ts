/**
 * Single source of truth for every server-side secret/config value this API
 * reads from the environment. Nothing outside this file should read
 * `process.env.*` or call `ConfigService.get(...)` directly - import
 * `secrets` from here instead. That gives us exactly one place to update
 * when replicating this project for a new deployment/business, and one
 * place that maps cleanly onto Firebase Secret Manager (or any other
 * secret manager) injecting these at deploy time.
 *
 * Schema/validation lives in ./env.validation.ts, which NestJS's
 * ConfigModule runs against process.env at boot (see app.module.ts) and
 * refuses to start the app if a required value is missing or malformed.
 * This file only reads the values - it does not re-validate them.
 *
 * Every field is a live getter (reads process.env on access, not once at
 * import time) so tests can freely set/delete process.env vars per-case
 * without needing to reload this module.
 *
 * To replicate this project for a new business: copy .env.example to .env,
 * fill in the values below, done. No other file needs to change.
 */
export const secrets = {
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? "development";
  },
  get port(): number {
    return Number(process.env.PORT ?? 4000);
  },
  get platformVersion(): string {
    return process.env.PLATFORM_VERSION ?? "0.1.0";
  },
  get logLevel(): string {
    return process.env.LOG_LEVEL ?? "info";
  },

  get databaseUrl(): string {
    return process.env.DATABASE_URL ?? "";
  },

  get jwtAccessSecret(): string {
    return process.env.JWT_ACCESS_SECRET ?? "";
  },
  get appSecretEncryptionKey(): string {
    return process.env.APP_SECRET_ENCRYPTION_KEY ?? "";
  },

  get webOrigin(): string {
    return process.env.WEB_ORIGIN || "http://localhost:3000";
  },

  get rateLimitTtlMs(): number {
    return Number(process.env.RATE_LIMIT_TTL_MS ?? 60_000);
  },
  get rateLimitLimit(): number {
    return Number(process.env.RATE_LIMIT_LIMIT ?? 100);
  },

  google: {
    get clientId(): string {
      return process.env.GOOGLE_CLIENT_ID ?? "";
    },
    get clientSecret(): string {
      return process.env.GOOGLE_CLIENT_SECRET ?? "";
    },
    get callbackUrl(): string {
      return process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/auth/google/callback";
    },
    get configured(): boolean {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  // --- Firebase (provisioning stub) ---------------------------------------
  // This project has no Firebase project yet. These fields exist so that
  // wiring one up later (Secret Manager, Admin SDK, etc.) only means
  // filling in env vars - not touching application code. Every value is
  // empty and `firebase.configured` is false until a real project exists;
  // nothing in this codebase requires them to boot. See docs/SECRETS.md.
  firebase: {
    get projectId(): string {
      return process.env.FIREBASE_PROJECT_ID ?? "";
    },
    get clientEmail(): string {
      return process.env.FIREBASE_CLIENT_EMAIL ?? "";
    },
    // Service account private keys are usually stored with literal "\n"
    // sequences (e.g. pasted from a downloaded JSON key into a single-line
    // env var) - un-escape them into real newlines for the crypto libs.
    get privateKey(): string {
      return (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
    },
    // Falls back to the main project id: Secret Manager usually lives in
    // the same Firebase/GCP project, but some setups split it out.
    get secretManagerProjectId(): string {
      return (
        process.env.FIREBASE_SECRET_MANAGER_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || ""
      );
    },
    get configured(): boolean {
      return Boolean(this.projectId && this.clientEmail && this.privateKey);
    },
  },
} as const;
