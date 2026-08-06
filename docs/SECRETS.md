# Secrets & config

This project routes every secret and environment-specific config value
through exactly **two** files:

| App                  | File                                                                  | What it's for                                                                   |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/api` (NestJS)  | [`apps/api/src/config/secrets.ts`](../apps/api/src/config/secrets.ts) | Server-only secrets (DB, JWT, encryption key, OAuth, Firebase Admin SDK).       |
| `apps/web` (Next.js) | [`apps/web/src/lib/env.ts`](../apps/web/src/lib/env.ts)               | Browser-exposed config (`NEXT_PUBLIC_*` only, plus Firebase client SDK config). |

Nothing else in the codebase should read `process.env.*` or call NestJS's
`ConfigService.get(...)` directly - always import `secrets` / `env` from
these files. That gives us:

- **No hardcoded secrets in the code.** Every value comes from the
  environment; the two files above just centralize _where_ they're read
  from and give them names/types.
- **One place to update per app.** Adding a new integration means adding
  one field to one file, not hunting down every call site that needs it.
- **A clean handoff to Firebase Secret Manager at deploy time.** See
  below.
- **Easy replication for a new business.** See below.

Validation (which values are required, and what shape they must be) lives
separately in [`apps/api/src/config/env.validation.ts`](../apps/api/src/config/env.validation.ts) - the API
refuses to boot if a required secret is missing or malformed. `secrets.ts`
only reads already-validated values; it doesn't re-validate them.

## What's required vs. optional today

Required for this project to run at all (no defaults - the API refuses to
boot without real values):

- `DATABASE_URL`
- `JWT_ACCESS_SECRET` (32+ chars - `openssl rand -base64 48`)
- `APP_SECRET_ENCRYPTION_KEY` (base64, 32 bytes - `openssl rand -base64 32`)
- `NEXT_PUBLIC_API_URL` (web app's pointer to the API)

Optional, degrade gracefully when unset:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` -
  Google Sign-In. `/auth/google` returns `501 Not Implemented` instead of
  crashing when these are empty.
- **Firebase** - this project has no Firebase project yet. Every
  `FIREBASE_*` / `NEXT_PUBLIC_FIREBASE_*` field is a provisioning stub:
  empty by default, and `secrets.firebase.configured` /
  `env.firebase.configured` are `false` until a real project exists.
  Nothing in the codebase depends on them today.

## Provisioning Firebase for this deployment

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com).
2. **Server-side (Admin SDK / Secret Manager):** Project Settings → Service
   Accounts → Generate new private key. Downloads a JSON file - copy
   `project_id`, `client_email`, and `private_key` into `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` in `.env`.
3. **Client-side (SDK config):** Project Settings → General → Your apps →
   add a Web app → copy the `firebaseConfig` object's fields into the
   matching `NEXT_PUBLIC_FIREBASE_*` vars in `apps/web/.env` (these are not
   secret - Firebase's client config is safe to ship to the browser - but
   they still route through `env.ts` for consistency).
4. Run `scripts/sync-secrets-to-firebase.sh` to push the server-side
   secrets from your `.env` into Firebase Secret Manager (requires the
   Firebase CLI, authenticated). Wire your deploy pipeline to read secrets
   from Secret Manager instead of a checked-in `.env` in production.

Store any downloaded service-account JSON / OAuth client secret files in
`secrets/local/` (gitignored) - never in the repo root, never committed.

## Replicating this project for a new business

1. Copy the repo (or spin up a fresh checkout from the template).
2. Copy each `.env.example` to `.env` (`.env.example` → `.env`,
   `apps/api/.env.example` → `apps/api/.env` if you run the API outside
   Docker, `apps/web/.env.example` → `apps/web/.env`).
3. Fill in the required values (database URL, generate fresh
   `JWT_ACCESS_SECRET` / `APP_SECRET_ENCRYPTION_KEY` - **do not reuse
   another deployment's values**), plus whichever optional integrations
   this business needs (Google OAuth, Firebase).
4. Nothing else changes. `secrets.ts` and `env.ts` pick up the new values
   automatically - no code to touch, no call sites to rewire.
