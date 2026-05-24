import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — shopping lists vs the REAL backend (seeded grocery list).
test("lists page shows the seeded grocery list + items", async ({ page }) => {
  await page.goto("/lists");
  await expect(page.getByRole("heading", { name: "Lists" })).toBeVisible();
  await expect(page.getByText(/Weekly groceries/)).toBeVisible();
  await expect(page.getByText("Whole milk", { exact: false })).toBeVisible();
  await expect(page.getByText("needs approval").first()).toBeVisible(); // the seeded Coffee beans
});

test("adding an item to a list makes it appear", async ({ page }) => {
  const item = `E2E item ${Date.now()}`;
  await page.goto("/lists");
  await page.getByLabel("Add to Weekly groceries").fill(item);
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(page.getByText(item)).toBeVisible();
});
