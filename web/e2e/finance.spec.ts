import { expect, test } from "./fixtures";

// Browser e2e (Playwright): the Finance approvals queue (approve + reject paths).
test("finance approvals queue lets you approve a pending expense", async ({ page }) => {
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: /Bills, expenses/ })).toBeVisible();
  await expect(page.getByText("2 pending your approval.")).toBeVisible();
  await expect(page.getByTestId("pending-row")).toHaveCount(2);

  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByTestId("pending-row")).toHaveCount(1);
  await expect(page.getByText("1 pending your approval.")).toBeVisible();
});

test("clearing the queue (approve + reject) shows the empty state", async ({ page }) => {
  await page.goto("/finance");
  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.getByRole("button", { name: "Reject" }).first().click();
  await expect(page.getByTestId("pending-row")).toHaveCount(0);
  await expect(page.getByText("0 pending your approval.")).toBeVisible();
  await expect(page.getByText("Nothing awaiting approval.")).toBeVisible();
  // The decided expenses remain in the full ledger with their new statuses.
  await expect(page.getByTestId("expense-row")).toHaveCount(3);
  await expect(page.getByText("rejected")).toBeVisible();
});

test("multi-currency amounts render (GBP + SGD)", async ({ page }) => {
  await page.goto("/finance");
  await expect(page.getByText("£1,840").first()).toBeVisible();
  await expect(page.getByText("SGD 2,640").first()).toBeVisible();
});
