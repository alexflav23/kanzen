import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — maintenance plans vs the REAL backend (seeded boiler service).
test("maintenance page shows the seeded plan", async ({ page }) => {
  await page.goto("/maintenance");
  await expect(page.getByRole("heading", { name: "Maintenance" })).toBeVisible();
  await expect(page.getByText("Boiler service")).toBeVisible();
});

test("adding a plan makes it appear", async ({ page }) => {
  const title = `E2E plan ${Date.now()}`;
  await page.goto("/maintenance");
  await page.getByLabel("New plan").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(title)).toBeVisible();
});
