import { expect, test } from "@playwright/test";

// Browser e2e (Playwright): the Inventory page lists assets and filters by category.
test("inventory lists assets and filters by category", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(page.getByTestId("asset-card")).toHaveCount(4);

  await page.getByRole("button", { name: "Watches" }).click();
  await expect(page.getByTestId("asset-card")).toHaveCount(1);
  await expect(page.getByText("Royal Oak")).toBeVisible();
});

test("nav links route from Dashboard to Inventory", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good morning." })).toBeVisible();
  await page.getByRole("link", { name: "Inventory" }).click();
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
});
