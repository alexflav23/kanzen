import { expect, test } from "./fixtures";

// Browser e2e (Playwright): the Inventory registry — stats, filter rail, search, detail.
test("inventory shows stats and lists every asset", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(page.getByText("Assets shown")).toBeVisible();
  await expect(page.getByText("Estimated value")).toBeVisible();
  await expect(page.getByTestId("asset-card")).toHaveCount(8);
});

test("the filter rail narrows by category, and Clear restores", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByRole("button", { name: /^Watches/ }).click();
  await expect(page.getByTestId("asset-card")).toHaveCount(2);
  await expect(page.getByText("Nautilus 5711")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByTestId("asset-card")).toHaveCount(8);
});

test("search narrows the registry", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByLabel("Search inventory").fill("Picasso");
  await expect(page.getByTestId("asset-card")).toHaveCount(1);
  await expect(page.getByText("La Colombe")).toBeVisible();
});

test("the list view renders a table", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByTestId("asset-row")).toHaveCount(8);
});

test("opening an asset shows its detail", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByTestId("asset-card").first().click();
  await expect(page.getByRole("heading", { name: "Royal Oak" })).toBeVisible();
  await expect(page.getByText("Valuation history")).toBeVisible();
  await expect(page.getByText("Attached documents")).toBeVisible();
});

test("nav links route from Dashboard to Inventory", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good morning, Toby." })).toBeVisible();
  await page.getByRole("link", { name: "Inventory" }).click();
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
});
