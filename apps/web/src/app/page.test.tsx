import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../lib/auth-context";
import LandingPage from "./page";

describe("LandingPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/auth/refresh")) {
          return Promise.resolve({
            ok: false,
            status: 401,
            headers: new Headers({ "content-type": "application/json" }),
            json: () => Promise.resolve({ message: "Unauthorized" }),
          });
        }

        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () =>
            Promise.resolve({
              status: "ok",
              database: "up",
              version: "0.1.0",
              environment: "test",
              timestamp: new Date().toISOString(),
            }),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the platform name and resolves API/database status", async () => {
    render(
      <AuthProvider>
        <LandingPage />
      </AuthProvider>,
    );

    expect(screen.getByText("SSCodeAxis")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Online")).toBeTruthy();
      expect(screen.getByText("Connected")).toBeTruthy();
    });
  });
});
