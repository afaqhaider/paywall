#!/bin/bash
# ---------------------------------------------------------------------------
# Pushes this deployment's secrets into Firebase Secret Manager, reading
# them from a local .env file (defaults to the repo root .env - the file
# consumed by docker-compose.yml). Run this once per deploy, or whenever a
# secret value changes.
#
# This project has no Firebase project yet, so running this script today
# will fail at the `gcloud`/`firebase` auth step - that's expected. It
# exists now so provisioning Firebase later (for this business, or when
# replicating this project for a new one) is "fill in .env, run this
# script" instead of hand-wiring secrets one at a time in a console.
#
# Requires: the Firebase CLI (`npm i -g firebase-tools`) or gcloud CLI,
# already authenticated (`firebase login` / `gcloud auth login`), and
# FIREBASE_PROJECT_ID set in the target .env file.
#
# Usage:
#   scripts/sync-secrets-to-firebase.sh [path-to-env-file]
# ---------------------------------------------------------------------------
set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: env file not found: $ENV_FILE" >&2
  exit 1
fi

# Every secret name that's actually a secret (excludes plain config like
# NODE_ENV, ports, or NEXT_PUBLIC_* - those are safe to ship in a build and
# don't belong in Secret Manager). Keep this list in sync with
# apps/api/src/config/secrets.ts and .env.example.
SECRET_NAMES=(
  DATABASE_URL
  JWT_ACCESS_SECRET
  APP_SECRET_ENCRYPTION_KEY
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  FIREBASE_CLIENT_EMAIL
  FIREBASE_PRIVATE_KEY
)

read_env_var() {
  local name="$1"
  # Last matching, non-comment KEY=VALUE line; strips surrounding quotes.
  grep -E "^${name}=" "$ENV_FILE" | tail -n1 | sed -E "s/^${name}=//; s/^\"(.*)\"$/\1/; s/^'(.*)'\$/\1/"
}

FIREBASE_PROJECT_ID="$(read_env_var FIREBASE_PROJECT_ID)"
if [[ -z "$FIREBASE_PROJECT_ID" ]]; then
  echo "error: FIREBASE_PROJECT_ID is not set in $ENV_FILE - nothing to sync to." >&2
  echo "This project has no Firebase project yet; see docs/SECRETS.md." >&2
  exit 1
fi

if ! command -v firebase >/dev/null 2>&1; then
  echo "error: firebase CLI not found. Install with: npm i -g firebase-tools" >&2
  exit 1
fi

echo "Syncing secrets from $ENV_FILE to Firebase project $FIREBASE_PROJECT_ID ..."

for name in "${SECRET_NAMES[@]}"; do
  value="$(read_env_var "$name")"
  if [[ -z "$value" ]]; then
    echo "  skip $name (not set in $ENV_FILE)"
    continue
  fi
  echo "  set  $name"
  printf '%s' "$value" | firebase functions:secrets:set "$name" \
    --project "$FIREBASE_PROJECT_ID" --data-file -
done

echo "Done."
