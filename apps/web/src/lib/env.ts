/**
 * Single source of truth for every client-side (browser-exposed) config
 * value in this app. Nothing outside this file should read
 * `process.env.NEXT_PUBLIC_*` directly - import from here instead, so
 * there is exactly one place to update when replicating this project for
 * a new deployment/business, and one place that maps cleanly onto
 * whatever secret manager (e.g. Firebase Secret Manager) ends up injecting
 * these at deploy time.
 *
 * Required for this project to run:
 *
 * NEXT_PUBLIC_API_URL — base URL of this project's own NestJS API (e.g.
 *   http://localhost:4000 locally, https://api.yourdomain.com in prod).
 *
 * Not required here: Google/GitHub OAuth client IDs and secrets. Those live
 * entirely server-side in apps/api/.env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 * etc.) - this is a server-initiated OAuth redirect flow (see
 * apps/web/src/components/google-signin-button.tsx, which just links to
 * `${API_URL}/auth/google`), so the browser never needs a Google client ID
 * of its own. Nothing to configure in this file for OAuth.
 *
 * Firebase: this project has no Firebase project yet. `env.firebase` below
 * is a provisioning stub - every value is empty and `firebase.configured`
 * is false until a real project exists, and nothing in this codebase
 * requires them to boot. See docs/SECRETS.md for how to wire one up (and
 * how the equivalent server-side stub in apps/api/src/config/secrets.ts
 * relates to this one).
 */
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  platformVersion: process.env.NEXT_PUBLIC_PLATFORM_VERSION ?? "0.1.0",
  // Next.js special-cases NODE_ENV: it's inlined into the client bundle at
  // build time even without a NEXT_PUBLIC_ prefix, unlike every other var.
  nodeEnv: process.env.NODE_ENV ?? "development",

  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
    get configured(): boolean {
      return Boolean(this.apiKey && this.projectId && this.appId);
    },
  },
} as const;
