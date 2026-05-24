import { expect, test } from "./fixtures";

// Browser e2e (Playwright): the deepened Dashboard (design parity).
test("dashboard shows the hero strip, upcoming, budgets and side panels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Good morning, Toby." })).toBeVisible();
  await expect(page.getByText("5 items awaiting your review, 2 expenses for approval.")).toBeVisible();

  // Attention strip
  await expect(page.getByText("5 items in Triage")).toBeVisible();
  await expect(page.getByText("2 expenses to approve")).toBeVisible();

  // Left column
  await expect(page.getByText("Next 14 days")).toBeVisible();
  await expect(page.getByText("Waitrose delivery")).toBeVisible();
  await expect(page.getByText("This month · by property")).toBeVisible();
  await expect(page.getByTestId("budget")).toHaveCount(2);
  await expect(page.getByText("Agent activity")).toBeVisible();

  // Right column
  await expect(page.getByText("Expiring within 60 days")).toBeVisible();
  await expect(page.getByText("Lapsed")).toBeVisible();
  await expect(page.getByText("Connected systems")).toBeVisible();
  await expect(page.getByText("Todoist")).toBeVisible();
});

test("the live at-a-glance summary shows real counts (F29)", async ({ page }) => {
  await page.goto("/");
  const glance = page.getByTestId("glance");
  await expect(glance).toBeVisible();
  await expect(glance.getByText("Properties")).toBeVisible();
  await expect(glance.getByText("To approve")).toBeVisible();
  await expect(page.getByTestId("glance-num").first()).toBeVisible(); // a real count rendered
});

test("the approvals card navigates to Finance", async ({ page }) => {
  await page.goto("/");
  await page.getByText("2 expenses to approve").click();
  await expect(page.getByRole("heading", { name: /Bills, expenses/ })).toBeVisible();
});
