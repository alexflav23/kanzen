import { expect, test } from "./fixtures";

// Browser e2e (Playwright): the Inventory page lists assets and filters by category.
test("inventory lists assets and filters by every category", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(page.getByTestId("asset-card")).toHaveCount(4);

  // Each single-item category narrows to one card, then "All" restores the full grid.
  for (const [cat, item] of [
    ["Watches", "Royal Oak"],
    ["Art", "La Colombe"],
    ["Guitars", "Les Paul Standard"],
    ["Glassware", "Tumblers ×6"],
  ] as const) {
    await page.getByRole("button", { name: cat, exact: true }).click();
    await expect(page.getByTestId("asset-card")).toHaveCount(1);
    await expect(page.getByText(item)).toBeVisible();
  }

  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByTestId("asset-card")).toHaveCount(4);
});

test("the active category chip reflects the selection", async ({ page }) => {
  await page.goto("/inventory");
  const watches = page.getByRole("button", { name: "Watches", exact: true });
  await expect(watches).toHaveAttribute("aria-pressed", "false");
  await watches.click();
  await expect(watches).toHaveAttribute("aria-pressed", "true");
});

test("nav links route from Dashboard to Inventory", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good morning." })).toBeVisible();
  await page.getByRole("link", { name: "Inventory" }).click();
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
});
