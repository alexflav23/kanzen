import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the Calendar agenda vs the REAL backend (seeded native events,
// dated relative to today, plus task/maintenance overlays). Read-only.
test("calendar shows the agenda with the seeded events", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.getByTestId("cal-event").first()).toBeVisible();
  await expect(page.getByText("Plumber visit · Wardian")).toBeVisible();
  await expect(page.getByText("Waitrose delivery")).toBeVisible();
});

test("the category filter narrows the agenda to one kind", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("button", { name: "Delivery" }).click();
  await expect(page.getByText("Waitrose delivery")).toBeVisible();
  // the maintenance event is filtered out
  await expect(page.getByText("Plumber visit · Wardian")).toBeHidden();
});
