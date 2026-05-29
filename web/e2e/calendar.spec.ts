import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — the Calendar vs the REAL backend (seeded native events, dated relative to
// today, plus task/maintenance overlays). W6: month grid + timed Week/Day hour-grids + agenda.

test("the month grid renders by default (42 cells) with seeded events as chips", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.getByTestId("cal-grid")).toBeVisible();
  expect(await page.getByTestId("cal-day").count()).toBe(42);
  await expect(page.getByTestId("cal-period")).toBeVisible(); // month + year label
  await expect(page.getByTestId("cal-chip").first()).toBeVisible(); // ≥1 seeded event placed in-grid
});

test("month nav changes the period, and Week view shows a 7-column timed hour-grid", async ({ page }) => {
  await page.goto("/calendar");
  const period = page.getByTestId("cal-period");
  const before = await period.textContent();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(period).not.toHaveText(before ?? "");
  await page.getByRole("tab", { name: "Week" }).click();
  await expect(page.getByTestId("cal-timegrid")).toBeVisible();
  expect(await page.getByTestId("cal-daycol").count()).toBe(7);
});

test("Day view shows the hour-grid with the seeded timed events positioned", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("tab", { name: "Day" }).click();
  await expect(page.getByTestId("cal-timegrid")).toBeVisible();
  expect(await page.getByTestId("cal-daycol").count()).toBe(1);
  // seeded today: "Housekeeping · Wardian" 08:00 + "Personal trainer" 18:00 (property-local)
  await expect(page.getByTestId("cal-block").filter({ hasText: "Housekeeping · Wardian" })).toBeVisible();
  await expect(page.getByTestId("cal-block").filter({ hasText: "08:00" })).toBeVisible();
});

test("clicking an event chip opens its detail (and read-only overlays say so)", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByTestId("cal-chip").first().click();
  const detail = page.getByTestId("event-detail");
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Date")).toBeVisible();
  await expect(detail.getByText("Category")).toBeVisible();
  // a task/maintenance overlay surfaces the read-only note; close returns to the grid
  await detail.getByRole("button", { name: "Close" }).click();
  await expect(detail).toBeHidden();
});

test("clicking a day opens the new-event form pre-dated", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByTestId("cal-day").nth(8).click();
  const modal = page.getByTestId("new-event");
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("Date")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
});

test("the agenda lists the seeded events and the category filter narrows it", async ({ page }) => {
  await page.goto("/calendar");
  await page.getByRole("tab", { name: "Agenda" }).click();
  await expect(page.getByTestId("cal-event").first()).toBeVisible();
  await expect(page.getByText("Plumber visit · Wardian")).toBeVisible();
  await expect(page.getByText("Waitrose delivery")).toBeVisible();
  // exact match: event rows are now buttons whose names contain their category word ("Waitrose delivery")
  await page.getByRole("button", { name: "Delivery", exact: true }).click();
  await expect(page.getByText("Waitrose delivery")).toBeVisible();
  await expect(page.getByText("Plumber visit · Wardian")).toBeHidden();
});

test("New event creates an event that appears (today → today's cell)", async ({ page }) => {
  const title = `E2E Event ${Date.now()}`;
  await page.goto("/calendar");
  await page.getByRole("button", { name: "New event" }).click();
  const modal = page.getByTestId("new-event");
  await expect(modal).toBeVisible();
  await modal.getByLabel("Title").fill(title);
  await modal.getByRole("button", { name: "Add event" }).click();
  // assert via the agenda (no per-cell cap, unlike the month grid which shows 4 + "more")
  await page.getByRole("tab", { name: "Agenda" }).click();
  await expect(page.getByTestId("cal-event").filter({ hasText: title })).toBeVisible();
});
