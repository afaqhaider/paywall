import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

/**
 * WEB_ORIGIN is a comma-separated allowlist (e.g. "https://app.example.com,https://admin.example.com").
 * Left unset, it falls back to allowing all origins - suitable for local development only.
 */
export function buildCorsOptions(webOrigin: string): CorsOptions {
  const origins = webOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    origin: origins.length > 0 ? origins : true,
    credentials: true,
  };
}
