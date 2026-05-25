import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — shopping lists vs the REAL backend (seeded "Grocery — Wardian").
test("lists page shows the seeded grocery list with its approval queue", async ({ page }) => {
  await page.goto("/lists");
  await expect(page.getByRole("heading", { name: "Lists" })).toBeVisible();

  // Open the Wardian grocery list from the master rail.
  await page.getByRole("button", { name: /Grocery — Wardian/ }).click();

  await expect(page.getByText("Whole milk", { exact: false })).toBeVisible();
  await expect(page.getByText(/need approval/)).toBeVisible(); // chip count for the seeded staff proposals
  await expect(page.getByTestId("approval-row").filter({ hasText: "Truffle" })).toBeVisible();
  await expect(page.getByText(/est\. £95/)).toBeVisible();
});

test("adding an item to a list makes it appear", async ({ page }) => {
  const item = `E2E item ${Date.now()}`;
  await page.goto("/lists");
  await page.getByRole("button", { name: /Grocery — Wardian/ }).click();
  await page.getByLabel("Add to Grocery — Wardian").fill(item);
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(page.getByText(item)).toBeVisible();
});

test("Principal approves a staff-proposed item, moving it out of the queue", async ({ page }) => {
  await page.goto("/lists");
  await page.getByRole("button", { name: /Grocery — Wardian/ }).click();
  const approvalRow = page.getByTestId("approval-row").filter({ hasText: "Sea bass" });
  await expect(approvalRow).toBeVisible();
  await page.getByRole("button", { name: "Approve Sea bass fillets" }).click();
  await expect(approvalRow).toHaveCount(0); // approved → leaves the awaiting-you queue
});
