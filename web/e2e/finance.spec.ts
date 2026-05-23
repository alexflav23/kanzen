import { expect, test } from "@playwright/test";

// Browser e2e (Playwright): the Finance approvals queue.
test("finance approvals queue lets you approve a pending expense", async ({ page }) => {
  await page.goto("/finance");
  await expect(page.getByRole("heading", { name: /Bills, expenses/ })).toBeVisible();
  await expect(page.getByTestId("pending-row")).toHaveCount(2);

  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByTestId("pending-row")).toHaveCount(1);
});
