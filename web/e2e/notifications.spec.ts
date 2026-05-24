import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the notification centre vs the REAL backend (seeded items for
// Flavian). Read-only: mark-read persists on the shared dev DB, so it's covered by Vitest + the
// backend IT, not here.
test("notifications lists the seeded items for the Principal", async ({ page }) => {
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByTestId("notification-row").first()).toBeVisible();
  // a seeded notification body renders
  await expect(page.getByText("Service the boiler", { exact: false })).toBeVisible();
});
