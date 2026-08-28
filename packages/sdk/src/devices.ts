import type { HttpClient } from "./client";
import type { RegisterDeviceInput, DeviceRegistration } from "./types";

/** Wraps `POST /public/devices`. Requires an application-scoped API key. */
export class DevicesClient {
  /**
   * Registers (or re-checks-in) a device. Upserts on `deviceId` - safe to
   * call every time your app starts, not just on first install. If
   * `licenseId` is set and that license has a `deviceLimit`, registering a
   * genuinely new device enforces it (throws `SdkApiError` 403 if full) -
   * an already-known device re-checking in is never rejected for this.
   */
  constructor(private readonly http: HttpClient) {}

  register(input: RegisterDeviceInput): Promise<DeviceRegistration> {
    return this.http.request<DeviceRegistration>("POST", "/public/devices", input);
  }
}
