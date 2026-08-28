/**
 * Thrown for any non-2xx response from the API. `status` and `body` are the
 * raw HTTP status and parsed JSON error body (when present) so callers can
 * branch on specific failure modes (e.g. 401 = bad/revoked API key, 403 =
 * usage limit exceeded, 404 = unknown entitlement key) without string-
 * matching `message`.
 */
export class SdkApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "SdkApiError";
    this.status = status;
    this.body = body;
  }
}

/** Thrown for client-side misuse (e.g. missing required config) - never for API responses. */
export class SdkConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SdkConfigError";
  }
}
