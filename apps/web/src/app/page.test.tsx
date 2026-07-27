import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./page";

describe("LandingPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            status: "ok",
            database: "up",
            version: "0.1.0",
            environment: "test",
            timestamp: new Date().toISOString(),
          }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the platform name and resolves API/database status", async () => {
    render(<LandingPage />);

    expect(screen.getByText("SS Zentronics Platform")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Online")).toBeTruthy();
      expect(screen.getByText("Connected")).toBeTruthy();
    });
  });
});
