import { test, expect } from "@playwright/test";

// F46 — the full onboarding wizard, end-to-end in a real browser against the live backend.
test.use({ storageState: { cookies: [], origins: [] } });

test("a new tenant can complete onboarding through the /onboard wizard", async ({ page }) => {
  // sign up
  await page.goto("/");
  await page.getByTestId("to-signup").click();
  const stamp = Date.now();
  await page.getByLabel("Workspace name").fill(`Okafor ${stamp}`);
  await page.getByLabel("Your name").fill("Ada Okafor");
  await page.getByLabel("Your email").fill(`ada-${stamp}@okafor.family`);
  await page.getByTestId("signup-submit").click();
  await expect(page.getByText("Dashboard").first()).toBeVisible({ timeout: 15_000 });

  // the Dashboard banner is present for the fresh tenant
  await expect(page.getByTestId("setup-banner")).toBeVisible({ timeout: 10_000 });

  // walk the wizard
  await page.goto("/onboard");
  await expect(page.getByTestId("onboard")).toBeVisible();
  await expect(page.getByText("Verify your email")).toBeVisible();
  await page.getByTestId("step-primary").click(); // verify_email

  await expect(page.getByText("Connect Google Workspace")).toBeVisible();
  await page.getByTestId("step-skip").click(); // workspace skip

  await expect(page.getByText("Add your first property")).toBeVisible();
  await page.getByLabel("Property name").fill("Okafor Residence");
  await page.getByTestId("step-primary").click(); // creates a property + advances

  // the remaining skippable steps, then finish
  for (let i = 0; i < 4; i++) {
    await page.getByTestId("step-primary").click();
    await page.waitForTimeout(250);
  }

  // landed back on the dashboard, banner gone (onboarding complete)
  await expect(page).toHaveURL(/\/$|\/$/);
  await expect(page.getByTestId("setup-banner")).toHaveCount(0, { timeout: 10_000 });
  // and the property we added during onboarding is in this tenant
  await page.goto("/properties");
  await expect(page.getByText("Okafor Residence")).toBeVisible({ timeout: 10_000 });
});
