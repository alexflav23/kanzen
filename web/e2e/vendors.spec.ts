import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the Vendors directory vs the REAL backend (seeded, scoped).
test("vendors page lists the approved directory with insurance status", async ({ page }) => {
  await page.goto("/vendors");
  await expect(page.getByRole("heading", { name: "Vendors" })).toBeVisible();
  await expect(page.getByText("Thames Plumbing")).toBeVisible();
  await expect(page.getByText("Insurance expired")).toBeVisible(); // Volt Electrics
});

test("New vendor creates a vendor that appears", async ({ page }) => {
  const name = `E2E Vendor ${Date.now()}`;
  await page.goto("/vendors");
  await page.getByRole("button", { name: "New vendor" }).click();
  const modal = page.getByTestId("new-vendor");
  await modal.getByLabel("Name").fill(name);
  await modal.getByRole("button", { name: "Add vendor" }).click();
  await expect(page.getByText(name)).toBeVisible();
});
