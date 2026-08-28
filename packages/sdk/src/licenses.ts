import type { HttpClient } from "./client";
import type { LicenseKeyValidationResult } from "./types";

/** Wraps `POST /public/runtime/license-keys/validate`. */
export class LicenseKeysClient {
  constructor(private readonly http: HttpClient) {}

  /** Validates a license key a customer entered (activation-status/expiry/activation-limit checks included). Never throws for an invalid key - check `.valid`. */
  validate(key: string): Promise<LicenseKeyValidationResult> {
    return this.http.request<LicenseKeyValidationResult>(
      "POST",
      "/public/runtime/license-keys/validate",
      { key },
    );
  }
}
