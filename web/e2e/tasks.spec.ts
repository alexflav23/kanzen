import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — native Tasks vs the REAL backend (seeded household tasks).
// Read-only + create (completing mutates the seed, covered by backend ITs + Vitest).
test("tasks page lists the seeded household tasks", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByText("Water the plants")).toBeVisible();
  await expect(page.getByText("Service the boiler")).toBeVisible();
  // a task can be linked to what it's about — a clickable chip through to the asset/property
  const link = page.getByTestId("task-links").getByRole("link").first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /\/(inventory|properties)\//);
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
  await modal.getByLabel("Recurrence").selectOption("fortnightly"); // extended cadence
  await modal.getByLabel("Priority").selectOption("urgent");
  await modal.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByTestId("new-task")).toHaveCount(0);
  // Todoist-grade row: priority is encoded on the row (the checkbox ring), not a pill
  const created = page.getByTestId("task-row").filter({ hasText: title });
  await expect(created).toBeVisible();
  await expect(created).toHaveAttribute("data-priority", "urgent");
  // completing is the circle (aria-labelled), not a "Complete" button
  await expect(page.getByRole("button", { name: `Complete ${title} (urgent priority)` })).toBeVisible();
});
