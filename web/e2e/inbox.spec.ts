import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the unified Inbox + ⌘K palette vs the REAL backend (seeded agent
// proposals + search index). Read-only: the triage rows are displayed, not actioned.
test("inbox shows stream counts and the seeded triage proposals", async ({ page }) => {
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await expect(page.getByTestId("inbox-glance")).toBeVisible();
  await expect(page.getByTestId("triage-row").first()).toBeVisible();
  // the seeded delivery proposal renders its email subject
  await expect(page.getByText("dispatched", { exact: false }).first()).toBeVisible();
  // the seeded Receipt proposal is financial → flagged Review (F27)
  await expect(page.getByText("Review").first()).toBeVisible();
});

test("⌘K opens the command palette and returns permission-filtered hits", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Meta+k"); // (Control+k also bound for non-mac)
  // fall back to Control if Meta didn't register on this platform
  if (!(await page.getByTestId("command-palette").isVisible().catch(() => false))) {
    await page.keyboard.press("Control+k");
  }
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill("guitar");
  await expect(page.getByTestId("cmdk-result").first()).toBeVisible();
  await expect(page.getByText("Les Paul Standard")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("command-palette")).toBeHidden();
});
