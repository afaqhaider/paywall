import { expect, test } from "@playwright/test";

/**
 * Checkpoint 8 of the SS Zentronics merge plan: the full click-through a
 * marketing-site visitor takes, from anonymous browsing to a completed
 * purchase, using paywall's own hosted pages as the "local stand-in" for
 * Atazaz's not-yet-built marketing frontend (the actual marketing site will
 * call `POST /public/checkout-intents` itself - see
 * docs/API_CONTRACT_MARKETING_SITE.md - but the storefront -> auth ->
 * checkout sequence below is identical either way).
 *
 * Requires a live API + seeded Postgres (an ACTIVE PaymentProvider, a
 * published PUBLIC Listing with an ACTIVE Plan/Price, and a registered
 * marketing-site API key) - skipped by default in this environment, which
 * has neither. Un-skip once running against a real stack; see
 * playwright.config.ts for how the base URL / webServer are configured.
 */
test.describe("marketing site checkout handoff", () => {
  test.skip(
    !process.env.E2E_LIVE_STACK,
    "Requires a live API + seeded Postgres - set E2E_LIVE_STACK=1 once one is available",
  );

  test("anonymous visitor browses, signs up, and completes a purchase", async ({
    page,
    request,
  }) => {
    // 1. Anonymous browse - no auth required.
    await page.goto("/marketplace");
    await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible();

    const firstApp = page.locator("a[href^='/marketplace/']").first();
    await firstApp.click();
    await expect(page.getByRole("heading")).toBeVisible();

    // 2. Hits "buy" while logged out -> sent to register.
    await page.goto("/register");
    const email = `e2e-${Date.now()}@example.com`;
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("SuperSecret123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Account created")).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("SuperSecret123!");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 3. Marketing site's own backend creates the checkout intent (API-key
    // call, not something the browser does - simulated here directly).
    const apiBase = process.env.E2E_API_URL ?? "http://localhost:4001";
    const intentResponse = await request.post(`${apiBase}/public/checkout-intents`, {
      headers: { "X-API-Key": process.env.E2E_MARKETING_API_KEY ?? "" },
      data: {
        customerEmail: email,
        planId: process.env.E2E_TEST_PLAN_ID ?? "",
        priceId: process.env.E2E_TEST_PRICE_ID ?? "",
      },
    });
    expect(intentResponse.ok()).toBeTruthy();
    const { id: intentId } = (await intentResponse.json()) as { id: string };

    // 4. Browser lands on the hosted checkout page, picks a provider.
    await page.goto(`/checkout/${intentId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Continue to payment" }).click();

    // 5. Redirected off-site to the chosen provider's real checkout - in a
    // real run this lands on Stripe/Easypaisa/JazzCash; here we only assert
    // the SPA navigated away from our own checkout page.
    await expect(page).not.toHaveURL(new RegExp(`/checkout/${intentId}$`));
  });
});
