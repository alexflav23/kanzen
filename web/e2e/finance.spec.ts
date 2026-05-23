import { expect, test } from "./fixtures";

// Browser e2e (Playwright): the tabbed Finance screen (design parity).
test("finance opens on the recurring schedule with the variance flag", async ({ page }) => {
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: /Bills, expenses/ })).toBeVisible();
  await expect(page.getByText("2 pending your approval.")).toBeVisible();
  await expect(page.getByText("Recurring schedule · 6")).toBeVisible();
  await expect(page.getByTestId("bill-row")).toHaveCount(6);
  await expect(page.getByText("SP Group · usage up 59.6%")).toBeVisible();
});

test("the pay queue tab lists scheduled and manual payments", async ({ page }) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: /Pay queue/ }).click();
  await expect(page.getByText("Auto-paid").first()).toBeVisible();
  await expect(page.getByTestId("pay-row")).toHaveCount(5);
  await expect(page.getByText("Mark paid")).toBeVisible();
});

test("the expenses tab approves and rejects, then shows the empty state", async ({ page }) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: /Expenses/ }).click();
  await expect(page.getByTestId("pending-row")).toHaveCount(2);
  await page.getByRole("button", { name: /Approve/ }).first().click();
  await expect(page.getByTestId("pending-row")).toHaveCount(1);
  await page.getByRole("button", { name: /Reject/ }).first().click();
  await expect(page.getByTestId("pending-row")).toHaveCount(0);
  await expect(page.getByText("Nothing awaiting approval.")).toBeVisible();
  await expect(page.getByTestId("expense-row")).toHaveCount(3);
});

test("the budgets tab shows per-property budget cards", async ({ page }) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: "Budgets" }).click();
  await expect(page.getByText("Wardian, Apt 5206 · 2026")).toBeVisible();
  await expect(page.getByText(/% used/).first()).toBeVisible();
});

test("multi-currency renders (GBP + SGD)", async ({ page }) => {
  await page.goto("/finance");
  await expect(page.getByText("S$613").first()).toBeVisible();
});
