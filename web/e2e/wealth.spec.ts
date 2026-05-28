import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the Private Wealth surface vs the REAL backend (seeded Flavian book:
// £5,000 opening cash + a VWRL lot). Read-only: net-worth GET only persists a snapshot.
test("wealth shows consolidated net worth, holdings and a balanced sheet", async ({ page }) => {
  await page.goto("/wealth");
  await expect(page.getByRole("heading", { name: "Net worth" })).toBeVisible();

  // the net-worth hero renders a real figure
  await expect(page.getByTestId("net-worth")).toBeVisible();
  await expect(page.getByTestId("networth-net")).toContainText("£");

  // the seeded VWRL holding appears with its columns
  await expect(page.getByTestId("holding-row").first()).toBeVisible();
  await expect(page.getByText("VWRL")).toBeVisible();

  // the balance sheet renders and reconciles
  await expect(page.getByTestId("balance-sheet")).toBeVisible();
  await expect(page.getByText("balanced")).toBeVisible();
});

test("switching to an entity scope reconverts the view", async ({ page }) => {
  await page.goto("/wealth");
  await page.getByRole("button", { name: "Flavian (Individual)" }).click();
  await expect(page.getByTestId("networth-net")).toBeVisible(); // recomputed for the entity
});

// W5.5 (F43) — income statement (P&L) for a period + CSV export.
test("the income statement renders for a period and exports a CSV", async ({ page }) => {
  await page.goto("/wealth");
  await expect(page.getByTestId("income-statement")).toBeVisible();
  await expect(page.getByTestId("is-income")).toContainText("£"); // real figure from the ledger
  await expect(page.getByTestId("is-net")).toContainText("£");
  await page.getByRole("button", { name: "This month" }).click(); // re-queries from/to
  await expect(page.getByTestId("income-statement")).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export statement CSV" }).click();
  expect((await dl).suggestedFilename()).toMatch(/income-statement.*\.csv/);
});
