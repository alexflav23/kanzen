import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — Insights vs the REAL backend (10 seeded assets). Registry-health
// bars render real percentages; running a scan (idempotent) raises data-quality flags.
test("insights shows registry-health bars over the seeded registry", async ({ page }) => {
  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();
  await expect(page.getByTestId("registry-health")).toBeVisible();
  expect(await page.getByTestId("health-bar").count()).toBe(4);
});

test("insights shows real analytics: KPIs, value-by-category and top assets (F29)", async ({ page }) => {
  await page.goto("/insights");
  await expect(page.getByTestId("insight-kpis")).toBeVisible();      // assets / lifetime spend / categories
  await expect(page.getByTestId("by-category")).toBeVisible();        // aggregated from real seeded assets
  expect(await page.getByTestId("cat-row").count()).toBeGreaterThanOrEqual(1);
  expect(await page.getByTestId("top-asset").count()).toBeGreaterThanOrEqual(1);
  // F29 spend-trend: monthly approved-expense bars (seeded GBP expenses)
  await expect(page.getByTestId("spend-trend")).toBeVisible();
  expect(await page.getByTestId("spend-bar").count()).toBeGreaterThanOrEqual(1);
});

test("running a scan surfaces data-quality flags", async ({ page }) => {
  await page.goto("/insights");
  await page.getByRole("button", { name: "Run scan" }).click();
  // the scan is idempotent; flags for the incomplete seeded assets appear
  await expect(page.getByTestId("flag-row").first()).toBeVisible();
});
