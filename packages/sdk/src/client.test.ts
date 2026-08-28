import { describe, expect, it, vi } from "vitest";
import { HttpClient } from "./client";
import { SdkApiError, SdkConfigError } from "./errors";

function mockFetch(status: number, body: unknown) {
  return vi.fn(
    async () => new Response(body === undefined ? "" : JSON.stringify(body), { status }),
  );
}

describe("HttpClient", () => {
  it("throws SdkConfigError when apiKey is missing", () => {
    expect(() => new HttpClient({ apiKey: "", baseUrl: "https://api.example.com" })).toThrow(
      SdkConfigError,
    );
  });

  it("throws SdkConfigError when baseUrl is missing", () => {
    expect(() => new HttpClient({ apiKey: "key", baseUrl: "" })).toThrow(SdkConfigError);
  });

  it("sends the API key header and parses a successful JSON response", async () => {
    const fetchImpl = mockFetch(200, { ok: true });
    const client = new HttpClient({
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
      fetchImpl,
    });

    const result = await client.request<{ ok: boolean }>("GET", "/foo");

    expect(result).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.com/foo",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ "X-API-Key": "test-key" }),
      }),
    );
  });

  it("strips a trailing slash from baseUrl", async () => {
    const fetchImpl = mockFetch(200, {});
    const client = new HttpClient({
      apiKey: "k",
      baseUrl: "https://api.example.com/",
      fetchImpl,
    });
    await client.request("GET", "/foo");
    expect(fetchImpl).toHaveBeenCalledWith("https://api.example.com/foo", expect.anything());
  });

  it("throws SdkApiError with the parsed body on a non-2xx response", async () => {
    const fetchImpl = mockFetch(403, { message: "Usage limit exceeded" });
    const client = new HttpClient({ apiKey: "k", baseUrl: "https://api.example.com", fetchImpl });

    await expect(client.request("POST", "/foo")).rejects.toMatchObject({
      name: "SdkApiError",
      status: 403,
      message: "Usage limit exceeded",
    });
  });

  it("SdkApiError is an instance of Error and carries the raw body", async () => {
    const fetchImpl = mockFetch(500, { message: "boom", detail: "x" });
    const client = new HttpClient({ apiKey: "k", baseUrl: "https://api.example.com", fetchImpl });

    try {
      await client.request("GET", "/foo");
      throw new Error("expected request() to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SdkApiError);
      expect(err).toBeInstanceOf(Error);
      expect((err as SdkApiError).body).toEqual({ message: "boom", detail: "x" });
    }
  });
});
