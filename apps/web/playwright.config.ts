import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm start",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
