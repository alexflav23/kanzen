import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — F03 Properties, end-to-end vs the REAL backend:
// authenticated shell → /api/properties + Bible aggregate/locations/defects from
// Postgres → rendered, no console or network errors (shared error-guard fixture).
test("lists the two seeded properties from the database", async ({ page }) => {
  await page.goto("/properties");
  await expect(page.getByRole("heading", { name: "Properties" })).toBeVisible();
  await expect(page.getByText("Wardian — Apt 5206")).toBeVisible();
  await expect(page.getByText("Singapore Residence")).toBeVisible();
  // ≥2 (other tests may add properties to the shared dev DB in parallel)
  expect(await page.getByTestId("property-card").count()).toBeGreaterThanOrEqual(2);
});

test("shows real per-property currency from the API", async ({ page }) => {
  await page.goto("/properties");
  await expect(page.getByText("GBP")).toBeVisible();
  await expect(page.getByText("SGD")).toBeVisible();
});

test("opening a property shows its Bible (overview, rooms, defects) from the API", async ({ page }) => {
  await page.goto("/properties");
  await page.getByText("Wardian — Apt 5206").click();
  // Overview
  await expect(page.getByText("Particulars")).toBeVisible();
  await expect(page.getByText("At a glance")).toBeVisible();
  // Rooms (none seeded yet → empty state)
  await page.getByRole("button", { name: "Rooms" }).click();
  await expect(page.getByText("No rooms yet")).toBeVisible();
  // Defects (none seeded yet → empty state)
  await page.getByRole("button", { name: "Defects" }).click();
  await expect(page.getByText("No defects")).toBeVisible();
});

test("Add property creates a property that appears in the list", async ({ page }) => {
  const name = `E2E House ${Date.now()}`;
  await page.goto("/properties");
  await page.getByRole("button", { name: "Add property" }).click();
  const modal = page.getByTestId("add-property");
  await expect(modal).toBeVisible();
  await modal.getByPlaceholder("e.g. Wardian — Apt 5206").fill(name);
  await modal.getByRole("button", { name: "Add property" }).click();
  await expect(page.getByText(name)).toBeVisible();
});
