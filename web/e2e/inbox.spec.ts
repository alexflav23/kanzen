import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the W9 collaborative inbox vs the REAL backend (seeded threads + the agent's
// auto-suggested proposals). Three-pane: rail · thread list · thread detail with the proposal inline.
test("the collaborative inbox lists threads and surfaces the agent's proposal on a thread", async ({ page }) => {
  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await expect(page.getByTestId("inbox-pane")).toBeVisible();
  await expect(page.getByTestId("thread-row").first()).toBeVisible();
  // open the seeded Ocado thread → its detail shows the agent's auto-suggested action with a confidence
  await page.getByTestId("thread-row").filter({ hasText: "Ocado" }).click();
  await expect(page.getByTestId("thread-detail")).toBeVisible();
  const proposal = page.getByTestId("agent-proposal").first();
  await expect(proposal).toBeVisible();
  await expect(proposal).toContainText("% sure"); // confidence — the auto-suggested intelligence
  await expect(proposal.getByRole("button", { name: "Confirm" })).toBeVisible();
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
