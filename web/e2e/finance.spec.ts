import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the tabbed Finance screen vs the REAL backend.
// Read-only assertions keep the shared dev DB idempotent (mutations are covered by
// backend ITs + Vitest with a stateful mock).
test("finance opens on the recurring schedule (seeded bills)", async ({ page }) => {
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: /Bills, expenses/ })).toBeVisible();
  await expect(page.getByText("Thames Water")).toBeVisible();
  await expect(page.getByText("British Gas")).toBeVisible();
  expect(await page.getByTestId("bill-row").count()).toBeGreaterThanOrEqual(2);
});

test("the pay queue tab lists scheduled payments (manual is markable)", async ({ page }) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: "Pay queue" }).click();
  await expect(page.getByTestId("pay-row").first()).toBeVisible(); // wait for the query
  expect(await page.getByTestId("pay-row").count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByText("Mark paid").first()).toBeVisible(); // a manual payment
  await expect(page.getByText("settles externally").first()).toBeVisible(); // an auto payment — never moved by us
});

test("the expenses tab shows the approval queue", async ({ page }) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: "Expenses" }).click();
  await expect(page.getByText(/Awaiting approval/)).toBeVisible();
  await expect(page.getByTestId("pending-row").first()).toBeVisible(); // wait for the query
  expect(await page.getByTestId("pending-row").count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByText(/All expenses/)).toBeVisible();
});

test("the transactions tab lists a seeded account's transactions with reconciliation state", async ({ page }) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: "Transactions" }).click();
  await expect(page.getByTestId("txn-row").first()).toBeVisible(); // wait for the query
  expect(await page.getByTestId("txn-row").count()).toBeGreaterThanOrEqual(1);
});

test("the reconcile tab auto-suggests a receipt match for a seeded transaction (F14)", async ({ page }) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: "Reconcile" }).click();
  await expect(page.getByTestId("recon-row").first()).toBeVisible(); // wait for the suggestions query
  // the seeded Hudson Sandler £1,840 txn + matching receipt → a high-confidence suggestion
  await expect(page.getByTestId("suggestion").first()).toBeVisible();
  await expect(page.getByText(/% match/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Confirm match/ }).first()).toBeVisible();
  // read-only: confirming persists on the shared dev DB, so it's covered by the backend IT + Vitest
});

test("the tax tab estimates UK income tax and shows the deductible report (F38)", async ({ page }) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: "Tax" }).click();
  await expect(page.getByTestId("estimate")).toBeVisible(); // wait for the estimate query
  await expect(page.getByText("Effective rate")).toBeVisible();
  await expect(page.getByText("estimate only")).toBeVisible(); // Kanzen never files
  await expect(page.getByTestId("deductible")).toBeVisible();
  await page.getByLabel("Gross income").fill("250000"); // re-estimates
  await expect(page.getByTestId("estimate")).toBeVisible();
});

test("the budgets tab notes the deferral", async ({ page }) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: "Budgets" }).click();
  await expect(page.getByText(/Per-property budgets arrive/)).toBeVisible();
});
