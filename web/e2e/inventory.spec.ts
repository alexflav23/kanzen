import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the Inventory registry vs the REAL backend (seeded assets).
test("inventory shows the seeded registry", async ({ page }) => {
  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(page.getByText("Assets shown")).toBeVisible();
  await expect(page.getByText("Royal Oak 15500ST")).toBeVisible();
  await expect(page.getByText("1959 Les Paul Standard")).toBeVisible();
});

test("the category rail narrows; Clear restores", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByRole("button", { name: /^Watches/ }).click();
  await expect(page.getByText("Royal Oak 15500ST")).toBeVisible();
  await expect(page.getByText("Submariner Date")).toBeVisible();
  await expect(page.getByText("1959 Les Paul Standard")).toHaveCount(0); // filtered out
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText("1959 Les Paul Standard")).toBeVisible();
});

test("search narrows by maker", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByLabel("Search inventory").fill("Gibson");
  await expect(page.getByText("1959 Les Paul Standard")).toBeVisible();
  await expect(page.getByText("Royal Oak 15500ST")).toHaveCount(0);
});

test("the list view renders rows", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByText("Royal Oak 15500ST")).toBeVisible();
  expect(await page.getByTestId("asset-row").count()).toBeGreaterThanOrEqual(5);
});

test("opening an asset shows its detail + specifications", async ({ page }) => {
  await page.goto("/inventory");
  await page.getByText("Royal Oak 15500ST").click();
  await expect(page.getByRole("heading", { name: "Royal Oak 15500ST" })).toBeVisible();
  await expect(page.getByText("Specifications")).toBeVisible();
  await expect(page.getByText("AP-15500")).toBeVisible(); // from the JSONB attributes
  // F19 lifecycle timeline (seeded acquisition event) + lifetime cost
  await expect(page.getByText("Lifecycle")).toBeVisible();
  await expect(page.getByText("Lifetime cost")).toBeVisible();
});

test("New asset creates an asset that appears", async ({ page }) => {
  const title = `E2E Asset ${Date.now()}`;
  await page.goto("/inventory");
  await page.getByRole("button", { name: "New asset" }).click();
  const modal = page.getByTestId("new-asset");
  await modal.getByLabel("Title").fill(title);
  await modal.getByLabel("Category").selectOption({ label: "Glassware" });
  await modal.getByRole("button", { name: "Add asset" }).click();
  await expect(page.getByText(title)).toBeVisible();
});

test("nav links route from Dashboard to Inventory", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good morning, Flavian." })).toBeVisible();
  await page.getByRole("link", { name: "Inventory" }).click();
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
});
