import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — F03 Properties read, end-to-end vs the REAL backend:
// authenticated shell → GET /api/properties (from Postgres) → cards rendered, no console
// or network errors (enforced by the shared error-guard fixture).
test("lists the two seeded properties from the database", async ({ page }) => {
  await page.goto("/properties");
  await expect(page.getByRole("heading", { name: "Properties" })).toBeVisible();
  await expect(page.getByTestId("property-card")).toHaveCount(2);
  await expect(page.getByText("Wardian — Apt 5206")).toBeVisible();
  await expect(page.getByText("Singapore Residence")).toBeVisible();
});

test("shows real per-property currency from the API", async ({ page }) => {
  await page.goto("/properties");
  await expect(page.getByText("GBP")).toBeVisible();
  await expect(page.getByText("SGD")).toBeVisible();
});
