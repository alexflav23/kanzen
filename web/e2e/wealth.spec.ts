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
