import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — native Tasks vs the REAL backend (seeded household tasks).
// Read-only + create (completing mutates the seed, covered by backend ITs + Vitest).
test("tasks page lists the seeded household tasks", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByText("Water the plants")).toBeVisible();
  await expect(page.getByText("Service the boiler")).toBeVisible();
});

test("adding a task makes it appear", async ({ page }) => {
  const title = `E2E task ${Date.now()}`;
  await page.goto("/tasks");
  await page.getByLabel("New task").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(title)).toBeVisible();
});
