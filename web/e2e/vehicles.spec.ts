import { expect, test } from "./fixtures";

// F04/F22 — Vehicles is NOT a bespoke module: it's the asset registry filtered to the 'vehicle'
// vertical, using the same generic surface. Verifies the seeded vehicle shows + other verticals don't.
test("Vehicles shows the seeded vehicle and only vehicles (the registry's 'vehicle' vertical)", async ({ page }) => {
  await page.goto("/vehicles");
  await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();
  await expect(page.getByText("Range Rover Autobiography")).toBeVisible();
  // other verticals (watches) are filtered out — proving it's vertical-scoped, not the whole registry
  await expect(page.getByText("Royal Oak 15500ST")).toHaveCount(0);
});

test("Vehicles is reachable from the nav", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Vehicles", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vehicles" })).toBeVisible();
});
