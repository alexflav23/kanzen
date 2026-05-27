import { expect, test } from "./fixtures";

// Browser e2e (Playwright): the Dashboard is now wired entirely to real backend reads
// (no mock data). Assertions avoid exact counts that other specs mutate (inbox/finance)
// and instead check the real panels + seeded content.
test("dashboard shows the real attention strip, upcoming, and side panels", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Flavian\./ })).toBeVisible();

  // Attention strip (real triage + real expenses awaiting approval)
  await expect(page.getByText("in Triage")).toBeVisible();
  await expect(page.getByTestId("approvals-cta")).toContainText("to approve");

  // Left column — real calendar event seeded within the next 14 days
  await expect(page.getByText("Next 14 days")).toBeVisible();
  await expect(page.getByText("Waitrose delivery")).toBeVisible();
  await expect(page.getByTestId("dash-expense").filter({ hasText: "Climatec" })).toBeVisible();

  // Right column — real expiring permits + lists (the Properties panel order varies with seed)
  await expect(page.getByText("Expiring within 60 days")).toBeVisible();
  await expect(page.getByText(/work permit|review due/).first()).toBeVisible();
  await expect(page.getByText("Grocery — Wardian")).toBeVisible();
});

test("the top bar exposes the ⌘K search + opens the command palette", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search Kanzen" }).click();
  await expect(page.getByTestId("command-palette")).toBeVisible(); // palette opened
});

test("the approvals CTA navigates to Finance", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("approvals-cta").click();
  await expect(page.getByRole("heading", { name: /Bills, expenses/ })).toBeVisible();
});
