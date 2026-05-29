import { expect, test } from "./fixtures";

// Browser e2e (Playwright) — maintenance plans vs the REAL backend (seeded boiler service).
test("maintenance page shows the seeded plan", async ({ page }) => {
  await page.goto("/maintenance");
  await expect(page.getByRole("heading", { name: "Maintenance" })).toBeVisible();
  await expect(page.getByText("Boiler service")).toBeVisible();
});

test("adding a plan makes it appear", async ({ page }) => {
  const title = `E2E plan ${Date.now()}`;
  await page.goto("/maintenance");
  await page.getByLabel("New plan").fill(title);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(title)).toBeVisible();
});

// W6.2/F11 — spawn a task from a plan; it lands in the property's project (and on the Calendar via its due date).
test("spawning a task from the boiler plan creates it under Tasks", async ({ page }) => {
  await page.goto("/maintenance");
  await page.getByRole("button", { name: "Spawn task for Boiler service" }).click();
  await expect(page.getByText("task created")).toBeVisible(); // the row flips to a confirmation
  // the spawned task appears under Tasks (titled after the plan)
  await page.goto("/tasks");
  await expect(page.getByTestId("task-row").filter({ hasText: "Boiler service" })).toBeVisible();
});
