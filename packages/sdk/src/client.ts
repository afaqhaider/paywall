import { SdkApiError, SdkConfigError } from "./errors";

export interface PaywallClientConfig {
  /** The API key issued to your application (Dashboard -> API Keys). Sent as `X-API-Key`. */
  apiKey: string;
  /**
   * Base URL of the platform API this application is deployed against, e.g.
   * `https://api.yourdomain.com`. No default is baked in - see this SDK's
   * README "External requirements" section for what needs to be filled in
   * before this can point at a real deployment.
   */
  baseUrl: string;
  /** Overrides the global `fetch` (e.g. for testing, or older Node runtimes). Defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Thin, dependency-free HTTP wrapper every resource class in this SDK is
 * built on. Not meant to be used directly by SDK consumers - see
 * `CheckoutClient`, `EntitlementsClient`, etc. in index.ts for the actual
 * public surface.
 */
export class HttpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: PaywallClientConfig) {
    if (!config.apiKey) {
      throw new SdkConfigError("apiKey is required");
    }
    if (!config.baseUrl) {
      throw new SdkConfigError("baseUrl is required - e.g. https://api.yourdomain.com");
    }
    if (typeof (config.fetchImpl ?? globalThis.fetch) !== "function") {
      throw new SdkConfigError(
        "No fetch implementation available - pass `fetchImpl` explicitly on Node < 18",
      );
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const parsed = text ? safeJsonParse(text) : undefined;

    if (!res.ok) {
      const message =
        (parsed && typeof parsed === "object" && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : undefined) ?? `Request failed with status ${res.status}`;
      throw new SdkApiError(res.status, message, parsed);
    }

    return parsed as T;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
