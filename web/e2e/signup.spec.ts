import { test, expect } from "@playwright/test";

// F46 — public workspace signup, end-to-end in a real browser against the live backend. Creating a workspace lands the
// new principal in their OWN clean, isolated household (no seeded data bleeds in).
test.use({ storageState: { cookies: [], origins: [] } }); // unauthenticated — we start at the sign-in screen

test("a new workspace can be created and lands in an empty, isolated household", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dev-login")).toBeVisible();

  await page.getByTestId("to-signup").click();
  const ws = `Carter ${Date.now()}`;
  await page.getByLabel("Workspace name").fill(ws);
  await page.getByLabel("Your name").fill("Toby Carter");
  await page.getByLabel("Your email").fill(`toby-${Date.now()}@carter.family`);
  await page.getByTestId("signup-submit").click();

  // we land in the authenticated shell (the left nav appears) — signup → token → app
  await expect(page.getByText("Dashboard").first()).toBeVisible({ timeout: 15_000 });

  // the new tenant is a clean household: the inventory is empty, not the seeded registry
  await page.goto("/inventory");
  await expect(page.getByText(/no assets|nothing here|empty/i).first()).toBeVisible({ timeout: 10_000 });
});
