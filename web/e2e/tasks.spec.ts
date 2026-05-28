import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — native Tasks vs the REAL backend (seeded household tasks).
// Read-only + create (completing mutates the seed, covered by backend ITs + Vitest).
test("tasks page lists the seeded household tasks", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByText("Water the plants")).toBeVisible();
  await expect(page.getByText("Service the boiler")).toBeVisible();
});

// W6.2 — the New-task modal: project · title · assignee · due date · recurrence.
test("adding a task with an assignee + due date + recurrence makes it appear", async ({ page }) => {
  const title = `E2E task ${Date.now()}`;
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task" }).click();
  const modal = page.getByTestId("new-task");
  await modal.getByLabel("Title").fill(title);
  await modal.getByLabel("Assignee").selectOption({ index: 1 }); // first real person
  await modal.getByLabel("Due date").fill("2026-06-15");
  await modal.getByLabel("Recurrence").selectOption("weekly");
  await modal.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByTestId("new-task")).toHaveCount(0);
  await expect(page.getByTestId("task-row").filter({ hasText: title })).toBeVisible(); // created
  await expect(page.getByText("due 2026-06-15")).toBeVisible(); // the due date round-tripped through the real backend
});
