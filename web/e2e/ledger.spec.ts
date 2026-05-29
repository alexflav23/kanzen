import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — F18/F39 Statements vs the REAL backend (Principal; seeded GL: a Coutts
// cash account + opening-balance entry). The general ledger is Principal-private; raw postings are
// never shown — only the chart of accounts and per-account registers.
test("statements: chart of accounts + an account register (no raw postings)", async ({ page }) => {
  await page.goto("/wealth");
  await page.getByRole("link", { name: "Statements →" }).click();
  await expect(page.getByRole("heading", { name: "Statements" })).toBeVisible();
  await expect(page.getByText("Chart of accounts", { exact: false })).toBeVisible();
  await expect(page.getByTestId("account-row").first()).toBeVisible();
  // the seeded opening-balance entry shows in the (auto-selected) first account's register
  await expect(page.getByTestId("register-row").first()).toBeVisible();
});
