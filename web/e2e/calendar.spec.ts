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

test("New event creates an event that appears in the agenda", async ({ page }) => {
  const title = `E2E Event ${Date.now()}`;
  await page.goto("/calendar");
  await page.getByRole("button", { name: "New event" }).click();
  const modal = page.getByTestId("new-event");
  await expect(modal).toBeVisible();
  await modal.getByLabel("Title").fill(title);
  await modal.getByRole("button", { name: "Add event" }).click();
  // window spans today±, and the default date is today → it lands in the agenda
  await expect(page.getByText(title)).toBeVisible();
});
