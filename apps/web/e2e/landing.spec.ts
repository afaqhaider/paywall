import { expect, test } from "@playwright/test";

test("landing page displays platform name and status cards", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "SSCodeAxis" })).toBeVisible();
  await expect(page.getByText("API Status")).toBeVisible();
  await expect(page.getByText("Database Status")).toBeVisible();
  await expect(page.getByText("Version")).toBeVisible();
});
