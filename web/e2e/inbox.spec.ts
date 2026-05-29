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
  // internal notes sit on their own (warm "Apple-note") surface, distinct from the email body
  await expect(page.getByTestId("internal-notes")).toBeVisible();
  // clicking the suggestion opens the review popup with the itemised receipt + total, then Confirm
  await proposal.click();
  const modal = page.getByTestId("proposal-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("proposal-total")).toContainText("142.50");
  await expect(modal).toContainText("never moves money"); // F27 surfaced before confirming
  await expect(modal.getByTestId("proposal-confirm")).toBeVisible();
});

test("a mailbox has standard folders — Inbox / Sent / Spam / Archive", async ({ page }) => {
  await page.goto("/inbox");
  await page.getByTestId("inbox-rail-item").filter({ hasText: "Deliveries" }).first().click();
  // the spam tab shows the flagged phishing thread, not the real deliveries
  await page.getByTestId("folder-spam").click();
  await expect(page.getByTestId("thread-row").filter({ hasText: "redelivery" })).toBeVisible();
  // back to Inbox — the phishing thread is NOT there
  await page.getByTestId("folder-inbox").click();
  await expect(page.getByTestId("thread-row").filter({ hasText: "Amazon" })).toBeVisible();
  await expect(page.getByTestId("thread-row").filter({ hasText: "redelivery" })).toHaveCount(0);
});

test("reply from the inbox: the Lexical composer sends a rich outbound message", async ({ page }) => {
  await page.goto("/inbox");
  // a personal thread (no proposal) is a clean place to reply
  await page.getByTestId("thread-row").filter({ hasText: "Eleanor" }).first().click();
  await expect(page.getByTestId("thread-detail")).toBeVisible();
  await page.getByTestId("reply-open").click();
  const editor = page.locator('[data-testid="reply-composer"] [contenteditable="true"]');
  await editor.click();
  const stamp = `e2e-reply-${Date.now()}`;
  await editor.pressSequentially(`${stamp} `);
  await page.getByRole("button", { name: "Bold" }).first().click();
  await editor.pressSequentially("done");
  await expect(page.getByTestId("reply-send")).toBeEnabled();
  await page.getByTestId("reply-send").click();
  // the outbound message appears in the thread with the typed text
  await expect(page.getByTestId("msg-outbound").filter({ hasText: stamp })).toBeVisible();
  await expect(page.getByTestId("inbox-toast")).toContainText("Reply sent");
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
